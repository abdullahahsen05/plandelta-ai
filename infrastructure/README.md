# Infrastructure

Production Docker, AWS, reverse-proxy, lifecycle, budget, and teardown assets live here. AWS
resources are created only after the complete local release gate passes.

Phase 9 uses two reviewable CloudFormation templates:

- `aws/budget.yaml` creates the gross-cost USD 25 monthly budget and absolute email alerts at USD
  10, 15, 20, and 25.
- `aws/storage.yaml` creates one private encrypted bucket, bounded lifecycle/CORS rules, and a
  permissions-boundary-constrained runtime role for S3 and one on-demand Bedrock model.

Deploy only with the authenticated non-root `plandelta` profile. The notification email is not a
secret, but no credentials belong in command arguments or templates.

```powershell
.\infrastructure\aws\deploy-phase9.ps1 -NotificationEmail you@example.com
.\infrastructure\aws\verify-phase9.ps1
```

The storage bucket is retained by CloudFormation to prevent accidental drawing deletion. The final
teardown procedure must explicitly inventory, export or approve deletion of retained objects before
removing the bucket.
