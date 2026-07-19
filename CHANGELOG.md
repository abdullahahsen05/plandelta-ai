# Changelog

All notable PlanDelta changes are documented here. The project follows
[Semantic Versioning](https://semver.org/) and uses release-candidate tags before its first stable
release.

## [Unreleased]

## [0.2.0] - 2026-07-19

### Added

- Evidence Copilot with durable conversations, resumable run events, interactive visual/document
  citations, and editable review-only RFI drafts.
- A bounded LangGraph supervisor with visual, knowledge, and impact specialists; allowlisted typed
  tools; claim/citation verification; one repair; safe fallback; cancellation; and per-run limits.
- Supporting-document ingestion with versioned extraction/chunking metadata, local BGE embeddings,
  Supabase pgvector/full-text hybrid retrieval, stale-source policy, and explicit conflict handling.
- Construction-drawing and engineering-schematic analysis profiles with committed sample drawings,
  expected evidence, supporting notes, and labelled cached answers.
- Frozen 30-case safety/evidence evaluation, redacted trace inspection, user quotas, and CloudWatch
  alarms for failures, latency, tool loops, token use, spend, queue depth, and invalid citations.
- A fifth private agent container on the existing cost-controlled `t3.small`, immutable ECR image,
  concurrency one, and an SSM runtime refresh that handles EC2 public-IP/TLS rotation.

### Verified

- Complete local matrix: migrations/seeds/RLS, all unit/service/integration suites, production
  builds, three Docker images, real upload-to-report, real ingestion-to-cited-Bedrock/RFI, browser
  journeys, dependency/container/secret scans, and the frozen evaluation.
- Production Vercel and AWS journeys for both deterministic drawing comparison/report and
  supporting-document ingestion/hybrid retrieval/cited chat, including disposable-data cleanup.

### Security

- Server-owned project/analysis scope, duplicate-tool detection, specialist/tool/result/time/token/
  cost/repair limits, prompt-injection boundaries, citation validation, and redacted persisted
  traces.
- Agent port remains private; EC2 administration remains SSM-only; no new paid vendor or prohibited
  AWS service was introduced.

### Known limitations

- Evaluation scores are curated regression evidence, not field accuracy or engineering approval.
- Live processing remains a temporary single-instance deployment and depends on source quality,
  deterministic alignment/OCR, Supabase, and on-demand Bedrock.
- Only construction drawings and the verified engineering-schematic sample/profile are supported;
  arbitrary images are out of scope.

## [0.1.0] - 2026-07-18

### Added

- A verified public Vercel production deployment with an always-available, clearly labelled sample.
- Explicit portfolio mode that disables live uploads and passwordless sign-in while temporary
  backend compute is offline.
- A production browser test path that verifies passwordless auth, real uploads, analysis evidence,
  report rendering, and API-driven cleanup against externally deployed origins.
- A cost-controlled AWS runtime with one `t3.small`, encrypted 20 GB gp3, CloudFormation-managed 2
  GB swap, SSM-only administration, public IP TLS, one concurrency-one worker, and seven-day logs.
- Private S3 artifacts, evidence-constrained on-demand Bedrock summaries, immutable ECR images,
  gross-cost budget alerts, and automated deployed-journey/recovery verification.

### Security

- Production CSP, framing, content-type, referrer, permissions, opener, and cross-domain-policy
  headers.
- Same-origin drawing delivery with no remote Next.js image allowlist and a verified HTTPS AWS API
  origin when live processing is enabled.
- IMDSv2, standard T3 credits, ports 80/443 only, encrypted configuration in SSM, and no SSH, load
  balancer, NAT Gateway, managed database, cache, or container cluster.

### Known limitations

- Live processing depends on temporary single-instance AWS compute; the labelled sample remains
  available when live processing is intentionally disabled.
- ECR scan-on-push is configured, but AWS Basic scanning does not accept the current OCI image-index
  media type; application dependencies and local container images were scanned before deployment.

## [0.1.0-rc.1] - 2026-07-18

### Added

- Authenticated project, revision, upload, analysis, retry, evidence, artifact, and printable-report
  workflows.
- A stateless FastAPI pipeline for page rendering, alignment, directional OpenCV differencing,
  PaddleOCR, normalized evidence, and private artifacts.
- A confidence-gated ONNX change classifier with a visible deterministic-rules fallback and
  reproducible synthetic benchmark evidence.
- A clearly labelled precomputed sample with true side-by-side source drawings, linked evidence,
  filters, zoom, pan, overlay, swipe, and print views.
- Versioned Supabase migrations, row-level isolation, Realtime progress, and a PostgreSQL-backed
  durable queue with leasing and concurrency one.
- Local Compose operation, health/readiness probes, structured redacted logs, traffic limits, user
  quotas, cleanup behavior, CI, dependency audits, and secret scanning.

### Security

- Containers run as unprivileged users with private writable data paths.
- Runtime request validation, upload/page/pixel bounds, timeouts, rate limits, correlation IDs, and
  safe error responses are enforced at trust boundaries.
- The release candidate excludes credentials, local uploads, generated artifacts, model caches,
  dependency trees, and build output from Git.

### Known limitations

- Analysis is decision support and must be checked against source drawings; it does not certify
  quantities, costs, code compliance, or constructability.
- The changed-region model metrics use a synthetic validation set and are not a claim of real-world
  accuracy.
- Live processing requires the Supabase, API, worker, and vision services. The public sample remains
  useful when temporary compute is unavailable.

[Unreleased]: https://github.com/abdullahahsen05/plandelta-ai/compare/v0.1.0...HEAD
[0.2.0]: https://github.com/abdullahahsen05/plandelta-ai/releases/tag/v0.2.0
[0.1.0]: https://github.com/abdullahahsen05/plandelta-ai/releases/tag/v0.1.0
[0.1.0-rc.1]: https://github.com/abdullahahsen05/plandelta-ai/releases/tag/v0.1.0-rc.1
