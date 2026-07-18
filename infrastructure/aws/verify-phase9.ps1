[CmdletBinding()]
param(
  [string]$Profile = "plandelta",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$identity = aws sts get-caller-identity --profile $Profile --region $Region --output json |
  ConvertFrom-Json
$accountId = [string]$identity.Account
$bucketName = "plandelta-$accountId-$Region"

$budget = aws budgets describe-budget `
  --account-id $accountId `
  --budget-name plandelta-project-monthly `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
if (
  [decimal]$budget.Budget.BudgetLimit.Amount -ne [decimal]25 -or
  $budget.Budget.BudgetLimit.Unit -ne "USD"
) {
  throw "The PlanDelta budget limit is not USD 25."
}

$notifications = aws budgets describe-notifications-for-budget `
  --account-id $accountId `
  --budget-name plandelta-project-monthly `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
$thresholds = @($notifications.Notifications | ForEach-Object { [decimal]$_.Threshold } | Sort-Object)
$expectedThresholds = @([decimal]10, [decimal]15, [decimal]20, [decimal]25)
if (
  $thresholds.Count -ne $expectedThresholds.Count -or
  (Compare-Object -ReferenceObject $expectedThresholds -DifferenceObject $thresholds)
) {
  throw "The required budget thresholds are not configured."
}
if (
  @(
    $notifications.Notifications |
      Where-Object {
        $_.NotificationType -ne "ACTUAL" -or
        $_.ComparisonOperator -ne "GREATER_THAN"
      }
  ).Count -ne 0
) {
  throw "Every PlanDelta budget notification must use actual spend and a greater-than threshold."
}

$publicBlock = aws s3api get-public-access-block `
  --bucket $bucketName `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
$block = $publicBlock.PublicAccessBlockConfiguration
if (-not ($block.BlockPublicAcls -and $block.IgnorePublicAcls -and $block.BlockPublicPolicy -and $block.RestrictPublicBuckets)) {
  throw "The S3 public access block is incomplete."
}

$policyStatus = aws s3api get-bucket-policy-status `
  --bucket $bucketName `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
if ($policyStatus.PolicyStatus.IsPublic) {
  throw "The PlanDelta S3 bucket policy is public."
}

$encryption = aws s3api get-bucket-encryption `
  --bucket $bucketName `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
$algorithm = $encryption.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm
if ($algorithm -ne "AES256") {
  throw "The PlanDelta S3 bucket does not use the expected default encryption."
}

$lifecycle = aws s3api get-bucket-lifecycle-configuration `
  --bucket $bucketName `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
if (@($lifecycle.Rules).Count -lt 3) {
  throw "The PlanDelta S3 lifecycle configuration is incomplete."
}

$cors = aws s3api get-bucket-cors `
  --bucket $bucketName `
  --profile $Profile `
  --region $Region `
  --output json | ConvertFrom-Json
if (@($cors.CORSRules).Count -ne 1) {
  throw "The PlanDelta S3 CORS configuration is not bounded to one rule."
}

$role = aws iam get-role `
  --role-name "plandelta-runtime-$Region" `
  --profile $Profile `
  --output json | ConvertFrom-Json
if ($role.Role.PermissionsBoundary.PermissionsBoundaryArn -ne "arn:aws:iam::$accountId`:policy/plandelta-runtime-boundary") {
  throw "The runtime role is missing its required permissions boundary."
}

Write-Output "Phase 9 controls verified: budget thresholds, private encrypted S3, lifecycle, CORS, and bounded runtime role."
