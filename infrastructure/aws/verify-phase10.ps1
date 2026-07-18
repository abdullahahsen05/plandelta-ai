[CmdletBinding()]
param(
  [string]$Profile = "plandelta",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "verify-phase9.ps1") -Profile $Profile -Region $Region

$stack = aws cloudformation describe-stacks `
  --stack-name plandelta-runtime `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
if ($stack.Stacks[0].StackStatus -notin @("CREATE_COMPLETE", "UPDATE_COMPLETE")) {
  throw "The PlanDelta runtime stack is not complete."
}
$outputs = @{}
foreach ($output in $stack.Stacks[0].Outputs) {
  $outputs[$output.OutputKey] = $output.OutputValue
}
$instanceId = [string]$outputs.InstanceId
$publicIp = [string]$outputs.PublicIp
if ($instanceId -notmatch "^i-[0-9a-f]+$" -or $publicIp -notmatch "^\d{1,3}(\.\d{1,3}){3}$") {
  throw "The runtime stack outputs are incomplete."
}

$instance = aws ec2 describe-instances `
  --instance-ids $instanceId `
  --profile $Profile `
  --region $Region `
  --query "Reservations[0].Instances[0]" `
  --output json | ConvertFrom-Json
if ($instance.State.Name -ne "running" -or $instance.InstanceType -ne "t3.small") {
  throw "The runtime is not one running t3.small."
}
if ($instance.MetadataOptions.HttpTokens -ne "required" -or $instance.MetadataOptions.HttpPutResponseHopLimit -ne 2) {
  throw "IMDSv2 is not enforced with the container hop limit."
}

$credits = aws ec2 describe-instance-credit-specifications `
  --instance-ids $instanceId `
  --profile $Profile `
  --region $Region `
  --query "InstanceCreditSpecifications[0].CpuCredits" `
  --output text
if ($credits.Trim() -ne "standard") {
  throw "The T3 instance is not using standard CPU credits."
}

$volumeId = [string]$instance.BlockDeviceMappings[0].Ebs.VolumeId
$volume = aws ec2 describe-volumes `
  --volume-ids $volumeId `
  --profile $Profile `
  --region $Region `
  --query "Volumes[0]" `
  --output json | ConvertFrom-Json
if ($volume.Size -ne 20 -or $volume.VolumeType -ne "gp3" -or -not $volume.Encrypted) {
  throw "The root volume is not an encrypted 20 GB gp3 volume."
}

$groupId = [string]$instance.SecurityGroups[0].GroupId
$group = aws ec2 describe-security-groups `
  --group-ids $groupId `
  --profile $Profile `
  --region $Region `
  --query "SecurityGroups[0]" `
  --output json | ConvertFrom-Json
$ingress = @($group.IpPermissions)
if ($ingress.Count -ne 2) {
  throw "The runtime security group has unexpected ingress rules."
}
$ports = @($ingress | ForEach-Object { [int]$_.FromPort } | Sort-Object)
if ((Compare-Object -ReferenceObject @(80, 443) -DifferenceObject $ports)) {
  throw "Only ports 80 and 443 may be public."
}

foreach ($repositoryName in @("plandelta-api", "plandelta-vision")) {
  $repository = aws ecr describe-repositories `
    --repository-names $repositoryName `
    --profile $Profile `
    --region $Region `
    --query "repositories[0]" `
    --output json | ConvertFrom-Json
  if ($repository.imageTagMutability -ne "IMMUTABLE" -or -not $repository.imageScanningConfiguration.scanOnPush) {
    throw "$repositoryName is not immutable with scan-on-push."
  }
}

aws ec2 wait instance-status-ok `
  --instance-ids $instanceId `
  --profile $Profile `
  --region $Region
if ($LASTEXITCODE -ne 0) {
  throw "The EC2 instance status checks did not pass."
}

$ssmOnline = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  $ping = aws ssm describe-instance-information `
    --profile $Profile `
    --region $Region `
    --filters "Key=InstanceIds,Values=$instanceId" `
    --query "InstanceInformationList[0].PingStatus" `
    --output text
  if ($ping.Trim() -eq "Online") {
    $ssmOnline = $true
    break
  }
  Start-Sleep -Seconds 10
}
if (-not $ssmOnline) {
  throw "The instance did not register as an online Systems Manager node."
}

$commandId = (
  aws ssm send-command `
    --instance-ids $instanceId `
    --document-name AWS-RunShellScript `
    --parameters 'commands=["cd /opt/plandelta && docker compose --env-file .env.runtime -f docker-compose.prod.yml ps --services --status running"]' `
    --profile $Profile `
    --region $Region `
    --query "Command.CommandId" `
    --output text
).Trim()
aws ssm wait command-executed `
  --command-id $commandId `
  --instance-id $instanceId `
  --profile $Profile `
  --region $Region
if ($LASTEXITCODE -ne 0) {
  throw "The remote container status command failed."
}
$containerStatus = aws ssm get-command-invocation `
  --command-id $commandId `
  --instance-id $instanceId `
  --profile $Profile `
  --region $Region `
  --query "StandardOutputContent" `
  --output text
$runningServices = @($containerStatus -split "\s+" | Where-Object { $_ })
foreach ($serviceName in @("api", "worker", "vision", "proxy")) {
  if ($serviceName -notin $runningServices) {
    throw "The remote $serviceName container is not confirmed running."
  }
}

$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "https://$publicIp/health/ready" `
      -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
      $healthy = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 10
  }
}
if (-not $healthy) {
  throw "The public HTTPS readiness endpoint did not pass."
}

$streamCount = aws logs describe-log-streams `
  --log-group-name /plandelta/production `
  --profile $Profile `
  --region $Region `
  --query "length(logStreams)" `
  --output text
if ([int]$streamCount -lt 4) {
  throw "CloudWatch does not contain streams for all four runtime services."
}

Write-Output "Phase 10 runtime verified: one bounded t3.small, encrypted gp3, SSM, immutable images, four running services, CloudWatch logs, and public HTTPS."
Write-Output "Verified API URL: https://$publicIp"
