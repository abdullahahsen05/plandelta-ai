# Architecture

## Repository layout

~~~text
apps/
  web/          Next.js user interface
  api/          NestJS HTTP API and worker entry point
  vision/       FastAPI computer-vision service
packages/
  contracts/    Shared schemas, enums, and generated API types
  ui/           Product-specific reusable interface primitives
  config/       Shared TypeScript, lint, and formatting configuration
infrastructure/
  docker/       Production compose and reverse-proxy configuration
  aws/          AWS setup documents and reproducible scripts
samples/        Non-sensitive baseline/revision fixtures and expected results
supabase/       SQL needed for RLS/functions beyond ORM migrations
docs/           Architecture, contract, security, testing, and deployment docs
~~~

## Runtime topology

### Local

- Next.js runs on the host or in its own development process.
- NestJS API and NestJS worker use the same codebase but separate entry points.
- FastAPI runs as an independent service.
- API, worker, and vision share a mounted local data directory through the
  LocalStorageProvider contract.
- Supabase PostgreSQL is hosted or local. Application behavior must not depend
  on production-only database features that cannot be tested.

### Production

- Vercel hosts Next.js.
- EC2 runs reverse proxy, NestJS API, NestJS worker, and FastAPI containers.
- Supabase hosts PostgreSQL and authentication.
- S3 stores private input and derived artifacts.
- Bedrock optionally generates evidence-grounded summaries.
- CloudWatch receives redacted structured logs.

## Service responsibilities

### Web

- Authentication UI and session handling.
- Project and revision workflows.
- Direct or API-mediated upload as selected by storage provider.
- Progress subscription plus polling fallback.
- Blueprint canvas and evidence presentation.
- Printable report.
- Never has Supabase service role or AWS credentials.

### NestJS API

- Authorization and ownership checks.
- CRUD for projects and revisions.
- Upload validation and storage metadata.
- Analysis job creation, status, retry, and result APIs.
- OpenAPI documentation.
- Report persistence and summary provider selection.
- No OpenCV or OCR code.

### NestJS worker

- Atomically claims queued jobs.
- Maintains lease and heartbeat.
- Obtains storage references for both revisions.
- Invokes the FastAPI service with correlation and engine metadata.
- Persists changes and artifacts transactionally.
- Calls local or Bedrock summary provider.
- Marks completion or a structured retryable/permanent failure.

### FastAPI vision service

- Stateless CPU-heavy blueprint processing.
- Accepts only authenticated internal requests.
- Reads two authorized local paths or short-lived signed URLs.
- Returns structured evidence and artifact references.
- Does not own users, projects, or authorization.

## Durable job state machine

~~~text
QUEUED
  -> CLAIMED
  -> PREPROCESSING
  -> ALIGNING
  -> DIFFING
  -> OCR
  -> CLASSIFYING
  -> SUMMARIZING
  -> COMPLETED

Any processing state -> RETRYING -> QUEUED
Any processing state -> FAILED
~~~

Use a lease owner, lease expiry, heartbeat, attempt count, next-attempt time,
and maximum attempts. Claim with a transaction and SKIP LOCKED semantics.
Concurrency starts at one vision job per EC2 instance.

## Vision pipeline

1. Validate file and selected page.
2. Render or decode.
3. Normalize orientation, scale, grayscale, and contrast.
4. Detect keypoints and align candidate to baseline.
5. Calculate alignment confidence and reject unsafe alignment.
6. Calculate added, removed, and absolute difference masks.
7. Apply morphology and extract/merge meaningful components.
8. Generate normalized boxes, polygons, evidence crops, and overlay.
9. OCR old/new crops and compare normalized strings.
10. Classify with rules and optional ONNX model.
11. Infer affected trades from category and text evidence.
12. Return results, metrics, warnings, and engine versions.

## Provider boundaries

StorageProvider:

- saveUpload
- createReadReference
- saveArtifact
- createDownloadReference
- deleteObject

SummaryProvider:

- summarizeAnalysis

Implementations:

- LocalStorageProvider and DeterministicSummaryProvider for local work.
- S3StorageProvider and BedrockSummaryProvider for AWS.

## Contract and versioning

- Public NestJS API prefix: /v1.
- Internal FastAPI prefix: /internal/v1.
- Vision result contains schemaVersion and engineVersion.
- Persist the exact engine/model version with every analysis.
- Breaking contract changes require a version bump and migration strategy.

## Reliability principles

- Database records are the source of truth, not in-memory task state.
- Uploads and artifact writes are atomic or uniquely keyed.
- Jobs are idempotent for a given analysis ID and engine version.
- Retries must not duplicate detected changes.
- All cross-service requests carry correlation ID and timeout.
- Failed alignment must produce a structured failure, not meaningless boxes.
