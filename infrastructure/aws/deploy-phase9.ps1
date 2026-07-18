[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')]
  [string]$NotificationEmail,

  [string]$Profile = "plandelta",
  [string]$Region = "us-east-1",
  [string]$WebOrigin = "https://plandelta-ai.vercel.app",
  [string]$BedrockModelId = "amazon.nova-micro-v1:0"
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$identity = aws sts get-caller-identity --profile $Profile --region $Region --output json |
  ConvertFrom-Json
if (-not $identity.Account -or $identity.Arn -like "*:root") {
  throw "A non-root authenticated AWS profile is required."
}

$accountId = [string]$identity.Account
$bucketName = "plandelta-$accountId-$Region"
$boundaryArn = "arn:aws:iam::$accountId`:policy/plandelta-runtime-boundary"

aws cloudformation deploy `
  --stack-name plandelta-cost-guard `
  --template-file (Join-Path $scriptRoot "budget.yaml") `
  --parameter-overrides "NotificationEmail=$NotificationEmail" `
  --profile $Profile `
  --region $Region `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) {
  throw "The PlanDelta budget stack did not deploy."
}

aws cloudformation deploy `
  --stack-name plandelta-storage `
  --template-file (Join-Path $scriptRoot "storage.yaml") `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    "BucketName=$bucketName" `
    "PermissionsBoundaryArn=$boundaryArn" `
    "WebOrigin=$WebOrigin" `
    "BedrockModelId=$BedrockModelId" `
  --profile $Profile `
  --region $Region `
  --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) {
  throw "The PlanDelta storage stack did not deploy."
}

Write-Output "PlanDelta Phase 9 budget and storage stacks deployed. Run verify-phase9.ps1 next."
