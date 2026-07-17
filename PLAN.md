# PlanDelta AI — Product and Engineering Plan

## Product statement

PlanDelta AI compares a baseline construction blueprint with a revised
blueprint, aligns them, detects visual and textual changes, classifies affected
elements, and produces an auditable change-impact report.

The product demonstrates full-stack engineering, computer vision, OCR,
production AI integration, typed service boundaries, durable job processing,
cloud storage, container deployment, and a premium visual interface.

## Primary user

A construction estimator, project engineer, architect, or subcontractor who
needs to understand what changed between drawing revisions without manually
overlaying and inspecting every region.

## Core user story

As an estimator, I upload an old and new plan, start an analysis, watch real
processing progress, inspect color-coded changes on a synchronized drawing
viewer, review changed notes and affected trades, and export a concise report.

## Required MVP journey

1. Visitor opens the product and can launch a built-in sample.
2. User signs in or uses the documented demo path.
3. User creates a project.
4. User uploads baseline and candidate revisions.
5. User selects a page when a PDF has more than one page.
6. User starts analysis.
7. API creates a durable queued job.
8. Worker claims the job and calls the FastAPI vision service.
9. Vision service renders, normalizes, aligns, diffs, extracts regions, runs
   OCR, classifies changes, and returns evidence plus metrics.
10. Worker persists results and generates a deterministic local summary.
11. UI receives progress and presents an interactive comparison workspace.
12. User filters changes, selects a region, reviews evidence, and exports a
   report.

## MVP capabilities

### Blueprint input

- PDF, PNG, JPG, and JPEG.
- One selected page per analysis.
- Safe MIME validation and configurable upload-size limit.
- Rotation and basic scan cleanup.
- Local storage provider for development.
- S3 provider added only after the local release gate.

### Computer vision

- Render PDF pages at a consistent DPI.
- Convert images to a consistent color space and resolution.
- Align revisions with feature matching and homography, with an ECC or
  translation fallback when appropriate.
- Calculate directional and absolute differences.
- Apply thresholding, morphology, contour extraction, and noise suppression.
- Merge nearby regions and discard regions below configurable thresholds.
- Preserve original evidence crops and an overlay artifact.
- Return alignment quality, changed-area percentage, timing, and confidence.

### OCR

- OCR old and new crops, not only the entire page.
- Extract room labels, dimensions, identifiers, and notes.
- Compare normalized text and preserve the raw values.
- Keep low-confidence OCR visible as low confidence rather than inventing text.

### Classification

- Baseline categories: wall/linework, door, window, fixture/symbol, dimension,
  text/note, room label, and unknown.
- Start with deterministic geometry and OCR rules.
- Add a small PyTorch changed-region classifier and export it to ONNX.
- If the trained classifier is not more accurate than the baseline on the
  committed validation set, keep the rules as default and document the result.

### Report

- Executive summary.
- Counts of additions, removals, modifications, and text-only changes.
- Affected trades.
- Evidence table with region, category, confidence, old text, new text, and
  likely impact.
- Method, engine version, limitations, and disclaimer.
- Printable HTML first; PDF export may use the browser print path for MVP.

## Out of scope for MVP

- Full BIM/IFC interpretation.
- Guaranteed quantity takeoff or legally binding cost estimates.
- Automatic code-compliance decisions.
- Multi-user organizations, billing, subscriptions, chat, or mobile apps.
- GPU infrastructure.
- Model training on private customer drawings.
- Perfect handling of unrelated drawing scales, viewpoints, or sheet layouts.

## Success criteria

- A first-time reviewer can run the sample in under two minutes.
- A real pair of similar plan revisions produces evidence-based change regions.
- Viewer interactions stay responsive on a typical laptop.
- Every result can be traced to a region on the drawings.
- Failed analyses show actionable errors and can be retried.
- Local analysis works with Bedrock disabled.
- Fresh setup is documented and reproducible.
- Root lint, typecheck, unit tests, build, and critical E2E tests pass.
- No secrets or uploaded customer files appear in Git history.

## Technology choices

- Monorepo: pnpm workspaces and Turborepo.
- Web: Next.js App Router, React, TypeScript, Tailwind CSS, customized
  shadcn/ui primitives, Motion, React Konva, PDF.js, TanStack Query, React Hook
  Form, and Zod.
- API: NestJS, Prisma, Swagger/OpenAPI, Pino, and Supabase JWT verification.
- Vision: Python, FastAPI, OpenCV, PyMuPDF, PaddleOCR, NumPy, Pillow, PyTorch,
  and ONNX Runtime.
- Data: Supabase PostgreSQL and Supabase Auth.
- Job queue: PostgreSQL-backed durable queue with leasing and heartbeat.
- Local runtime: Docker Compose and a shared data volume.
- Production: Vercel for web; AWS ECR, EC2, S3, Bedrock, IAM, and CloudWatch for
  backend and AI.
- Cloud budget: $100 promotional AWS credit. Default cloud posture is temporary
  portfolio infrastructure, not an indefinitely always-on production estate.

## Quality strategy

- Contract-first payloads.
- Deterministic sample fixtures and golden CV tests.
- Storage and summary provider interfaces.
- Structured events and correlation IDs across services.
- Small, reviewable commits.
- Documentation updated in the same commit as behavior.

## Local release gate

AWS work cannot begin until:

- The full upload-to-report journey works locally.
- The built-in sample works from a clean setup.
- Supabase migrations work against a clean database.
- All required tests and production builds pass.
- Docker Compose health checks pass.
- README contains setup, architecture, demo, limitations, and troubleshooting.
- A secret scan and staged-diff review pass.

## Final release gate

- Vercel frontend is live and continues to demonstrate the labelled sample even
  when temporary AWS compute is unavailable.
- NestJS API, Nest worker, and FastAPI vision service have run successfully on
  EC2 containers.
- S3 stores production artifacts through least-privilege IAM.
- Bedrock summaries are configurable and visibly attributed as AI-generated.
- CloudWatch receives structured service logs.
- Health endpoints and one complete deployed analysis are verified.
- Actual AWS cost, cost guardrails, and teardown evidence are documented.
- EC2, attached EBS, idle public IPv4, and unnecessary log resources are stopped
  or deleted when the user no longer needs live processing.
- GitHub repository is clean, public, documented, and uses small commits.

## AWS budget policy

- Hard available credit: $100.
- Target total project AWS spend: no more than $25.
- Warning threshold: $15 actual or forecast spend.
- Emergency teardown threshold: $25 unless the user explicitly authorizes more.
- Default EC2: one t3.small, 20 GB gp3, one worker, CPU credit mode standard.
- A temporary t3.medium resize is allowed only after measured memory failure on
  t3.small and must be reversed when no longer needed.
- Prohibited for this portfolio deployment: NAT Gateway, Application Load
  Balancer, RDS, ElastiCache, OpenSearch, SageMaker endpoints, EKS, ECS/Fargate,
  provisioned Bedrock throughput, and always-on duplicate environments.
- Supabase remains the hosted PostgreSQL provider; Vercel remains the frontend.
- Build containers locally or in GitHub Actions so EC2 time is used for running
  and verification, not lengthy compilation.

## Credential readiness gate

Before Phase 0, Codex must complete docs/CREDENTIALS.md with the user. Required
Supabase and AWS access is configured locally, ignored by Git, and verified
without printing values. This single up-front checkpoint is intended to prevent
later phases from stopping unexpectedly for credentials.
