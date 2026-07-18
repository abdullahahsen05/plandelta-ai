# Deployment Plan

Deployment happens only after the local release gate in PLAN.md passes. The AWS
deployment is a cost-controlled portfolio environment governed by a $100 credit
ceiling and a $25 target total spend.

## Environments

- local: local storage and deterministic summary
- preview: Vercel preview plus non-production backend when available
- portfolio: Vercel and a clearly labelled precomputed sample remain available
- live processing: EC2, S3, Bedrock, CloudWatch, and Supabase

Keep separate environment files/secrets and storage prefixes. Never point tests
at production resources.

## Vercel

1. Connect GitHub repository plandelta-ai.
2. Set the monorepo root/build configuration for apps/web.
3. Configure public Supabase URL/anon key and public API base URL.
4. Keep all service-role, database, AWS, and internal-service secrets out of
   Vercel client variables.
5. Set `NEXT_PUBLIC_LIVE_PROCESSING_ENABLED=false` until the AWS API is verified.
   While disabled, use the reserved non-routable
   `NEXT_PUBLIC_API_URL=https://api.plandelta-ai.invalid`; no live request should
   be issued and the labelled sample remains available.
6. Before enabling live processing, replace that reserved URL with the verified
   HTTPS API origin and set the API `WEB_ORIGINS` value to the exact Vercel
   production origin.
7. Keep Next.js remote image patterns empty. Source drawings and evidence are
   delivered through authenticated same-origin proxy routes.
8. Deploy and test routes, client console, network failures, and responsive UI.
9. Add the verified URL to README.

## AWS services

### S3

- Private bucket with public access block.
- Default encryption.
- Versioning only if its cost/benefit is documented.
- Lifecycle for temporary, demo, and abandoned-upload prefixes.
- CORS restricted to required origins and methods.
- Separate prefixes for originals, renders, overlays, evidence, and reports.

### ECR

- Separate images or repositories for api and vision.
- Immutable semantic-version or Git-SHA tags.
- Lifecycle removes old unreferenced images.
- Do not deploy latest-only tags.

### EC2

Default to one t3.small with 20 GB gp3, T3 CPU credit mode standard, 2 GB swap,
one worker, and concurrency one. Use lightweight PaddleOCR models and lazy model
loading. A temporary t3.medium resize is allowed only after a measured t3.small
memory failure and must be reversed when no longer required.

Create the instance only after the local release gate. Build images locally or
in GitHub Actions before starting the instance. Do not keep EC2 running during
long inactive development periods.

Production compose services:

- reverse proxy
- NestJS API
- NestJS worker
- FastAPI vision

Use restart policies, health checks, log limits, CPU/memory limits, and a
non-root user. Supabase remains external, so PostgreSQL does not run on EC2.

Do not add a NAT Gateway, load balancer, RDS, ElastiCache, OpenSearch,
SageMaker endpoint, EKS, ECS/Fargate, or a second environment.

The implemented portfolio runtime uses the default public subnet, one automatically assigned
public IPv4 address, and no SSH ingress. Systems Manager is the only administrative path. The
instance runs one API container, one worker, one private vision container, and one Caddy proxy.
The runtime configuration is an allowlisted SSM `SecureString` bundle; API/worker and vision receive
separate environment files so the vision service does not receive database credentials.

Because this portfolio deployment does not require a purchased domain or load balancer, Certbot
requests a publicly trusted short-lived certificate for the instance IPv4 address and a systemd
timer checks renewal every 12 hours. Terminating the instance releases the paid public IPv4 address.
A stop/start changes the automatic address, so restore by replacing the runtime stack rather than
presenting a stale certificate or URL.

### Bedrock

- Use on-demand invocation.
- Model ID and region are configuration, not code constants.
- Verify selected model supports required input and is covered by available
  credits before use.
- Send cropped evidence and structured CV/OCR results rather than unnecessarily
  large full-resolution plans.
- Cap input/output, timeout, and retries.

### IAM and access

- EC2 instance profile grants only required S3, Bedrock, ECR pull, and log
  actions.
- GitHub Actions uses OIDC if it pushes images.
- Prefer Systems Manager for administration; otherwise restrict SSH to a known
  source and document key handling.
- Security groups expose only HTTPS/HTTP as needed. Vision is not public.

### Logs and monitoring

- JSON logs with service, environment, correlation ID, analysis ID, level, and
  safe error code.
- CloudWatch retention limit to control cost.
- Alarm on repeated health failure, disk pressure, and abnormal failed-job rate
  where practical.
- Never log signed URLs, OCR text from private plans, or secrets.

## Production configuration

Required categories:

- Supabase public and server values
- direct and pooled database URLs
- storage provider and S3 bucket/region
- summary provider and Bedrock model/region
- internal vision authentication
- public web/API origins
- upload/processing limits
- worker concurrency, lease, retries, and timeout
- log level and environment

Validate configuration at startup and fail with names of missing variables, not
their values.

## Deployment verification

1. API live and ready health endpoints.
2. Vision readiness and engine metadata through internal check.
3. Authentication and unauthorized denial.
4. Upload sample revisions.
5. Observe durable progress.
6. Inspect detected changes and artifacts.
7. Generate deterministic and Bedrock summaries.
8. Restart worker and verify recovery.
9. Verify all S3 objects remain private.
10. Inspect CloudWatch logs for correlation and redaction.

## Cost controls

- Hard available credit is $100; target total project AWS spend is $25.
- The verified price inputs, credit-product eligibility, and conservative
  projection are recorded in [AWS_COSTS.md](./AWS_COSTS.md).
- Configure AWS Budgets notifications at $10, $15, $20, and $25 before
  persistent resources. Alerts do not replace manual monitoring or teardown.
- At $15 actual/forecast, inspect costs immediately. At $25, tear down
  nonessential resources unless the user explicitly authorizes more.
- Record expected monthly EC2, EBS, IPv4, S3, ECR, data transfer, CloudWatch,
  and Bedrock costs.
- Prefer us-east-1 when service/model availability permits.
- Use small fixtures and lifecycle cleanup.
- Do not leave unattached volumes, snapshots, elastic IPs, or unused images.
- Provide stop and teardown instructions.
- Verify promotional-credit eligibility instead of assuming every service is
  covered.

## Live-resource lifecycle

After successful deployment:

1. Run the full deployed analysis twice.
2. Confirm logs, private S3 objects, Bedrock output, and health checks.
3. Record safe screenshots, architecture evidence, and actual spend.
4. Ask the user whether live processing should remain active.
5. If not, terminate EC2/EBS, release paid IPv4, remove temporary logs and
   unused images, and confirm Vercel still serves the labelled sample.

## Rollback and teardown

Document:

- previous ECR image tag and compose rollback command
- database migration compatibility
- Vercel rollback
- safe EC2 stop/start
- S3 object retention/export
- resource deletion order
- confirmation that teardown will not delete Supabase or user data unless
  explicitly requested
- exact resource inventory and final retained/deleted status
