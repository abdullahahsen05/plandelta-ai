[CmdletBinding()]
param(
  [string]$Profile = "plandelta",
  [string]$Region = "us-east-1",
  [string]$WebOrigin = "https://plandelta-ai.vercel.app",
  [string]$EnvironmentParameterName = "/plandelta/production/env",
  [ValidatePattern("^[0-9a-f]{40}$")]
  [string]$ImageTag,
  [string]$VpcId,
  [string]$SubnetId
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$identity = aws sts get-caller-identity --profile $Profile --region $Region --output json |
  ConvertFrom-Json
if (-not $identity.Account -or $identity.Arn -like "*:root") {
  throw "A non-root authenticated AWS profile is required."
}

$accountId = [string]$identity.Account
$bucketName = "plandelta-$accountId-$Region"
$boundaryArn = "arn:aws:iam::$accountId`:policy/plandelta-runtime-boundary"
$headCommit = (git -C $repositoryRoot rev-parse HEAD).Trim()
$remoteCommits = @(
  git -C $repositoryRoot ls-remote origin |
    ForEach-Object { ($_ -split "\s+")[0] }
)
if ($headCommit -notmatch "^[0-9a-f]{40}$" -or $headCommit -notin $remoteCommits) {
  throw "Deploy only a full commit that is already present on the origin remote."
}
if (-not $ImageTag) {
  $ImageTag = $headCommit
}
if (git -C $repositoryRoot status --porcelain) {
  throw "Deploy only from a clean working tree."
}

& (Join-Path $PSScriptRoot "verify-phase9.ps1") -Profile $Profile -Region $Region

if (-not $VpcId) {
  $VpcId = (
    aws ec2 describe-vpcs `
      --profile $Profile `
      --region $Region `
      --filters Name=is-default,Values=true `
      --query "Vpcs[0].VpcId" `
      --output text
  ).Trim()
}
if (-not $SubnetId) {
  $SubnetId = (
    aws ec2 describe-subnets `
      --profile $Profile `
      --region $Region `
      --filters "Name=vpc-id,Values=$VpcId" Name=map-public-ip-on-launch,Values=true `
      --query "sort_by(Subnets,&AvailabilityZone)[0].SubnetId" `
      --output text
  ).Trim()
}
if ($VpcId -notmatch "^vpc-[0-9a-f]+$" -or $SubnetId -notmatch "^subnet-[0-9a-f]+$") {
  throw "A valid default VPC and public subnet are required."
}

Write-Output "Updating the bounded runtime role before creating compute."
aws cloudformation deploy `
  --stack-name plandelta-storage `
  --template-file (Join-Path $PSScriptRoot "storage.yaml") `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    "BucketName=$bucketName" `
    "PermissionsBoundaryArn=$boundaryArn" `
    "WebOrigin=$WebOrigin" `
    "BedrockModelId=amazon.nova-micro-v1:0" `
    "EnvironmentParameterName=$EnvironmentParameterName" `
  --profile $Profile `
  --region $Region `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) {
  throw "The bounded runtime role update failed."
}

Write-Output "Creating immutable PlanDelta ECR repositories."
aws cloudformation deploy `
  --stack-name plandelta-ecr `
  --template-file (Join-Path $PSScriptRoot "ecr.yaml") `
  --profile $Profile `
  --region $Region `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) {
  throw "The PlanDelta ECR stack failed."
}

$env:PLANDELTA_AWS_REGION = $Region
$env:PLANDELTA_S3_BUCKET = $bucketName
$env:PLANDELTA_WEB_ORIGIN = $WebOrigin
$encodedEnvironment = node (Join-Path $repositoryRoot "scripts\encode-production-env.mjs")
if ($LASTEXITCODE -ne 0 -or -not $encodedEnvironment) {
  throw "The allowlisted production environment could not be encoded."
}
aws ssm put-parameter `
  --name $EnvironmentParameterName `
  --description "Encrypted allowlisted PlanDelta production environment" `
  --type SecureString `
  --tier Standard `
  --value $encodedEnvironment `
  --overwrite `
  --profile $Profile `
  --region $Region `
  --query Version `
  --output text | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "The encrypted production environment could not be stored."
}
Remove-Variable encodedEnvironment

$apiExists = (
  aws ecr list-images `
  --repository-name plandelta-api `
  --filter tagStatus=TAGGED `
  --profile $Profile `
  --region $Region `
  --query "contains(imageIds[].imageTag, '$ImageTag')" `
  --output text
).Trim() -eq "True"
$agentExists = (
  aws ecr list-images `
  --repository-name plandelta-agent `
  --filter tagStatus=TAGGED `
  --profile $Profile `
  --region $Region `
  --query "contains(imageIds[].imageTag, '$ImageTag')" `
  --output text
).Trim() -eq "True"
$visionExists = (
  aws ecr list-images `
  --repository-name plandelta-vision `
  --filter tagStatus=TAGGED `
  --profile $Profile `
  --region $Region `
  --query "contains(imageIds[].imageTag, '$ImageTag')" `
  --output text
).Trim() -eq "True"
if (($apiExists -ne $agentExists) -or ($apiExists -ne $visionExists)) {
  throw "The immutable release tag is present in only a subset of the three repositories."
}

$registry = "$accountId.dkr.ecr.$Region.amazonaws.com"
if (-not $apiExists) {
  Write-Output "Building the three production images from the verified commit."
  docker compose -f (Join-Path $repositoryRoot "docker-compose.yml") build agent api vision
  if ($LASTEXITCODE -ne 0) { throw "The production image build failed." }

  aws ecr get-login-password --profile $Profile --region $Region |
    docker login --username AWS --password-stdin $registry
  if ($LASTEXITCODE -ne 0) { throw "The ECR login failed." }

  docker tag plandelta-api:local "$registry/plandelta-api`:$ImageTag"
  docker tag plandelta-agent:local "$registry/plandelta-agent`:$ImageTag"
  docker tag plandelta-vision:local "$registry/plandelta-vision`:$ImageTag"
  docker push "$registry/plandelta-api`:$ImageTag"
  if ($LASTEXITCODE -ne 0) { throw "The API image push failed." }
  docker push "$registry/plandelta-agent`:$ImageTag"
  if ($LASTEXITCODE -ne 0) { throw "The agent image push failed." }
  docker push "$registry/plandelta-vision`:$ImageTag"
  if ($LASTEXITCODE -ne 0) { throw "The vision image push failed." }
} else {
  Write-Output "The immutable release tag already exists in all three repositories."
}

$rollbackStack = aws cloudformation list-stacks `
  --stack-status-filter ROLLBACK_COMPLETE `
  --profile $Profile `
  --region $Region `
  --query "contains(StackSummaries[].StackName, 'plandelta-runtime')" `
  --output text
if ($rollbackStack.Trim() -eq "True") {
  Write-Output "Removing the fully rolled-back runtime stack before retry."
  aws cloudformation delete-stack `
    --stack-name plandelta-runtime `
    --profile $Profile `
    --region $Region
  aws cloudformation wait stack-delete-complete `
    --stack-name plandelta-runtime `
    --profile $Profile `
    --region $Region
  if ($LASTEXITCODE -ne 0) {
    throw "The rolled-back runtime stack could not be removed."
  }
}

Write-Output "Creating the one-instance PlanDelta runtime."
aws cloudformation deploy `
  --stack-name plandelta-runtime `
  --template-file (Join-Path $PSScriptRoot "runtime.yaml") `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    "VpcId=$VpcId" `
    "SubnetId=$SubnetId" `
    "RuntimeRoleName=plandelta-runtime-$Region" `
    "EnvironmentParameterName=$EnvironmentParameterName" `
    "ReleaseCommit=$headCommit" `
    "ImageTag=$ImageTag" `
  --profile $Profile `
  --region $Region `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) {
  throw "The one-instance PlanDelta runtime stack failed."
}

$instanceId = (
  aws cloudformation describe-stacks `
    --stack-name plandelta-runtime `
    --profile $Profile `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue | [0]" `
    --output text
).Trim()
if ($instanceId -notmatch "^i-[0-9a-f]+$") {
  throw "The runtime instance ID could not be resolved after deployment."
}

Write-Output "Refreshing the existing instance with the immutable release."
$refreshScriptUrl =
  "https://raw.githubusercontent.com/abdullahahsen05/plandelta-ai/$headCommit/infrastructure/runtime/refresh-runtime.sh"
$refreshCommand =
  "curl --fail --silent --show-error --location $refreshScriptUrl --output /tmp/plandelta-refresh-runtime.sh && " +
  "bash /tmp/plandelta-refresh-runtime.sh $headCommit $ImageTag $EnvironmentParameterName $Region $accountId"
$refreshParameters = "commands=[`"$refreshCommand`"]"
$commandId = (
  aws ssm send-command `
    --instance-ids $instanceId `
    --document-name AWS-RunShellScript `
    --parameters $refreshParameters `
    --timeout-seconds 900 `
    --profile $Profile `
    --region $Region `
    --query "Command.CommandId" `
    --output text
).Trim()
if ($LASTEXITCODE -ne 0 -or $commandId -notmatch "^[0-9a-f-]+$") {
  throw "The runtime refresh command could not be started."
}

$refreshStatus = "InProgress"
for ($attempt = 0; $attempt -lt 90; $attempt++) {
  Start-Sleep -Seconds 10
  $refreshStatus = (
    aws ssm get-command-invocation `
      --command-id $commandId `
      --instance-id $instanceId `
      --profile $Profile `
      --region $Region `
      --query Status `
      --output text
  ).Trim()
  if ($refreshStatus -notin @("Pending", "InProgress", "Delayed")) {
    break
  }
}
if ($refreshStatus -ne "Success") {
  $refreshError = (
    aws ssm get-command-invocation `
      --command-id $commandId `
      --instance-id $instanceId `
      --profile $Profile `
      --region $Region `
      --query StandardErrorContent `
      --output text
  ).Trim()
  throw "The runtime refresh failed with status $refreshStatus. $refreshError"
}

Write-Output "Phase 10 resources and immutable runtime deployed. Run verify-phase10.ps1 before claiming availability."
