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

Phase 10 adds:

- `aws/ecr.yaml`: three AES-256-encrypted, scan-on-push repositories with immutable tags and a
  five-image lifecycle cap.
- `aws/runtime.yaml`: one public `t3.small`, encrypted 20 GB gp3, standard CPU credits, IMDSv2,
  SSM-only administration, ports 80/443, seven-day CloudWatch logs, and two low-cost alarms. It
  creates no NAT Gateway, load balancer, database, cache, cluster, or provisioned Bedrock resource.
- `runtime/docker-compose.prod.yml`: one API, one concurrency-one worker, one private bounded agent
  service with local embeddings, one private vision service, and one Caddy TLS proxy with bounded
  CPU/memory and CloudWatch logging.
- `aws/deploy-phase10.ps1`: verifies Phase 9, stores only an allowlisted encrypted runtime bundle in
  SSM Parameter Store, builds and pushes three immutable Git-SHA images, and deploys the single
  instance.
- `aws/verify-phase10.ps1`: verifies the instance, volume, CPU-credit mode, ingress, SSM, ECR,
  containers, CloudWatch streams, and public HTTPS before availability is claimed.

The runtime requests a six-day Let's Encrypt certificate for its assigned public IPv4 address and
checks renewal twice daily. The automatic public address is released with instance termination; a
stop/start changes it and requires a runtime replacement, so the intended cost-control action after
evidence capture is teardown rather than an indefinite stopped instance.

Run Phase 10 only from a clean commit already pushed to the public `origin` remote. This permits
production verification of a reviewed release branch before it is merged, while rejecting local-only
or dirty revisions:

```powershell
.\infrastructure\aws\deploy-phase10.ps1
.\infrastructure\aws\verify-phase10.ps1
```

Neither script prints or commits the encrypted environment value.
