# Changelog

All notable PlanDelta changes are documented here. The project follows
[Semantic Versioning](https://semver.org/) and uses release-candidate tags before its first stable
release.

## [Unreleased]

### Added

- A verified public Vercel portfolio deployment with an always-available, clearly labelled sample.
- Explicit portfolio mode that disables live uploads and passwordless sign-in while temporary
  backend compute is offline.
- A cost-controlled AWS runtime with one `t3.small`, encrypted 20 GB gp3, CloudFormation-managed 2
  GB swap, SSM-only administration, public IP TLS, one concurrency-one worker, and seven-day logs.
- Private S3 artifacts, evidence-constrained on-demand Bedrock summaries, immutable ECR images,
  gross-cost budget alerts, and automated deployed-journey/recovery verification.

### Security

- Production CSP, framing, content-type, referrer, permissions, opener, and cross-domain-policy
  headers.
- Same-origin drawing delivery with no remote Next.js image allowlist and a reserved non-routable
  API origin until the AWS service is verified.
- IMDSv2, standard T3 credits, ports 80/443 only, encrypted configuration in SSM, and no SSH, load
  balancer, NAT Gateway, managed database, cache, or container cluster.

### Known limitations

- Vercel remains in portfolio mode until the Supabase project owner allowlists
  `https://plandelta-ai.vercel.app/auth/callback`.
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

[0.1.0-rc.1]: https://github.com/abdullahahsen05/plandelta-ai/releases/tag/v0.1.0-rc.1
