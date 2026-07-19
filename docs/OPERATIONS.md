# Operations Guide

## Service topology

PlanDelta runs five processes: the Next.js web application, the public NestJS
API, one NestJS worker, the private FastAPI vision service, and the private
FastAPI agent service. Supabase PostgreSQL/Auth/pgvector remains external.
Local object storage is a private shared volume; production uses private S3
through the same interface.

Only the web application and API are public. Vision and agent ports remain
private. One worker and one agent execution with concurrency one are the
cost-controlled defaults.

## Health and readiness

| Endpoint | Purpose | Success criteria |
| --- | --- | --- |
| `GET /health/live` | API process liveness | Process can serve HTTP |
| `GET /health/ready` | API dependency readiness | Database, vision, and agent readiness pass |
| `GET /health/live` on port 8000 | Vision process liveness | FastAPI process can serve HTTP |
| `GET /health/ready` on port 8000 | Vision engine readiness | Required CV runtime is available |
| `GET /health/live` on port 8100 | Agent process liveness | FastAPI process can serve HTTP |
| `GET /health/ready` on port 8100 | Agent readiness | Database/configuration is ready without eagerly loading embeddings |

Liveness does not promise that an analysis can finish. Load balancers, Compose,
and operators should use readiness when dependency health matters.

## Default safety limits

All values are startup-validated and configurable through server-side
environment variables.

| Limit | Default |
| --- | ---: |
| Request timeout | 30 seconds |
| Reads per IP per minute | 300 |
| Writes per IP per minute | 60 |
| Uploads per user per rolling 24 hours | 40 |
| Uploaded bytes per user per rolling 24 hours | 500 MiB |
| Analyses per user per rolling hour | 12 |
| Active analyses per user | 3 |
| Agent messages per user per day | 20 |
| Agent estimated cost per user per day | USD 0.20 |
| Concurrent AWS agent runs | 1 |
| Agent tool calls / model turns / repair passes | 12 / 8 / 1 |
| Agent wall-clock timeout | 60 seconds |
| One uploaded file | 20 MiB |
| PDF pages | 50 |
| Decoded image pixels | 60 million |
| Worker concurrency | 1 |

The IP limiter is intentionally in-memory because the deployed runtime has
one API instance and no load balancer. User-level upload and analysis quotas
plus agent message/cost/concurrency quotas are enforced from PostgreSQL and
remain authoritative. A future multi-instance deployment must replace the IP
limiter with a shared implementation.

Limit failures return `429` with a safe code and `Retry-After` where
applicable. Request timeouts return `503 REQUEST_TIMEOUT`; dependency readiness
returns `503 DEPENDENCY_UNAVAILABLE`.

## Data lifecycle and cleanup

- Original uploads and completed evidence are retained until the owning user
  deletes the associated revision or analysis. PlanDelta does not silently
  expire user source drawings locally.
- Deleting an unused revision deletes its private original object. A revision
  referenced by an analysis cannot be deleted.
- Deleting a queued, retrying, failed, or completed analysis deletes its
  database record and the complete `analyses/{analysisId}` artifact prefix.
- Actively leased analyses cannot be deleted. This prevents cleanup racing a
  worker write.
- A database failure after an upload removes the just-written object.
- Worker scratch data is scoped to ignored runtime storage and is not source
  control material.
- User uploads are never used as classifier training data.
- Deleting a knowledge document removes its source/version objects and makes
  its chunks unavailable to retrieval; stale versions remain auditable until
  the owning document is deleted.
- Agent answers, citations, and safe traces are durable project records.
  Disposable verification projects and users are removed after each journey.

The AWS storage phase must add S3 lifecycle rules for abandoned multipart
uploads and temporary/demo prefixes. Permanent originals and evidence remain
user-controlled. CloudWatch log groups use a finite retention period; 14 days
is the portfolio default unless measured troubleshooting needs justify less.

## Structured logs and redaction

API and worker logs are JSON messages carried through the framework logger.
Operational events include:

- `http_request`
- `analysis_processing_started`
- `analysis_processing_completed`
- `worker_started`
- `stale_jobs_recovered`
- `job_claimed`
- `job_failed`
- `worker_loop_error`
- `agent_run_completed`
- `agent_run_failed`
- `agent_tool_invocation`
- `agent_quota_denied`

Records contain safe operational identifiers, stages, status, duration,
counters, region count, and engine version where relevant. They do not contain
authorization headers, cookies, environment values, database URLs, signed
URLs, raw drawing bytes, OCR text, prompts, answers, or retrieved chunks.
Correlation IDs connect browser/API failures to worker/agent activity without
exposing private content.

## Local operation

```powershell
pnpm docker:up
docker compose ps
Invoke-RestMethod http://localhost:4000/health/ready
Invoke-RestMethod http://localhost:8000/health/ready
```

Follow service logs without printing environment configuration:

```powershell
docker compose logs --tail 100 api worker agent vision
```

Stop the application while preserving its named local data volume:

```powershell
pnpm docker:down
```

Do not add `--volumes` unless the explicit intent is to delete local runtime
artifacts.

## API examples

Swagger UI is available at `http://localhost:4000/docs` during local
development. Authenticated examples use a temporary Supabase access token from
the caller's own session; never store one in shell history or documentation.

```powershell
$headers = @{
  Authorization = "Bearer $env:PLANDELTA_ACCESS_TOKEN"
  "X-Correlation-Id" = [guid]::NewGuid().ToString()
}

Invoke-RestMethod `
  -Uri "http://localhost:4000/v1/projects?limit=20" `
  -Headers $headers
```

Create an analysis only with revision IDs returned by the authenticated
project:

```powershell
$body = @{
  baselineRevisionId = $env:PLANDELTA_BASELINE_REVISION_ID
  candidateRevisionId = $env:PLANDELTA_CANDIDATE_REVISION_ID
  configuration = @{ page = 1 }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:4000/v1/projects/$env:PLANDELTA_PROJECT_ID/analyses" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

## Incident checklist

1. Check API and vision readiness separately.
2. Locate the safe correlation ID in structured logs.
3. Inspect worker stage, lease, attempt count, and next-attempt time.
4. Confirm Supabase connectivity without printing connection strings.
5. Confirm storage is private and writable without displaying object contents.
6. Retry only a failed analysis through the supported API/UI action.
7. If a worker is replaced, verify stale-lease recovery before manual database
   intervention.
8. Record the error code, affected analysis ID, timing, and remediation.

Never fix a production incident by weakening RLS, exposing S3, raising worker
concurrency above the measured host capacity, or copying secrets into logs.
