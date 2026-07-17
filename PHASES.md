# PlanDelta AI — Execution Phases

Codex must execute these phases sequentially without asking for routine
approval. Mark checkboxes only after evidence exists. Do not skip exit gates.

## Current execution state

- Current phase: Phase 7 — Hardening, documentation, and local release candidate
- Current task: Publish the verified repository and confirm default-branch CI
- Last verified command: Gitleaks `v8.30.1` scanned all 61 commits on 2026-07-18 with no leaks; the complete root release gate, fresh-clone rehearsal, final Docker builds and high/critical scans, non-root API/worker/vision startup, API and vision readiness, one-worker enforcement, and authenticated upload-to-report journey also passed (3 contract, 5 web, 26 API, and 27 vision unit tests; 3 contract, 26 API, 1 vision, and 6 browser E2E checks passed; the credentialed live browser journey was intentionally skipped in the fixture suite)
- Active blockers: None; AWS resource creation remains intentionally gated behind Phase 7 rather than blocked by authority
- Last completed implementation commit: `fe8627f fix(test): isolate browser build output`
- Local app status: The product is verified from authenticated upload through worker, real CV/OCR, confidence-gated ONNX classification with visible rules fallback, private artifacts, true side-by-side original drawing previews, React Konva evidence, Realtime/polling progress, retry, and printable report; Docker API and vision services are healthy and one containerized worker is running with concurrency one
- Supabase status: Both versioned migrations applied; Auth/API, RLS isolation, Realtime publication, pooled runtime access, direct migrations, queue concurrency, and idempotent seed verified
- GitHub status: Codex profile and CLI authentication verified for `abdullahahsen05`; `plandelta-ai` is available, no remote exists yet, and public repository creation waits only for the final committed-history secret scan
- Vercel status: CLI authentication verified; not deployed
- AWS status: MFA-protected non-root IAM user, temporary browser-authenticated `plandelta` profile, `us-east-1`, billing visibility, required service reads, scoped permissions boundary, bounded role/instance-profile creation, EC2 pass-role, and GitHub OIDC verified; no billable project resources created
- AWS credit budget: $100 remaining and 173 days verified on 2026-07-17; expires 2027-01-04 unless depleted; $25 project-spend target
- Credential preflight: Supabase, Vercel, GitHub, and scoped non-root AWS deployment access passed

## Credential preflight — blocking before Phase 0

- [x] Read docs/CREDENTIALS.md and inspect .env.example.
- [x] Ask the user once to configure every required Supabase value in the
      ignored local environment file.
- [x] Ask the user to authenticate AWS CLI profile plandelta through browser
      login/SSO and select the region.
- [x] Ask the user to authenticate Vercel CLI interactively when it is not
      already connected.
- [x] Confirm the $100 credit constraint and $25 target spend.
- [x] Verify the local secret file is ignored before reading it.
- [x] Validate presence and safe format of required variable names without
      printing values.
- [x] Verify AWS access with STS, record only the account alias/role when safe,
      and never expose credentials.
- [x] Verify GitHub authentication already available to Codex.
- [x] Verify Vercel authentication without requesting a raw token in chat.
- [x] Record any unavailable optional deployment credentials, but obtain all
      Supabase/AWS access needed by the committed plan.
- [x] Receive explicit user confirmation to begin implementation.

Exit gate:

- [x] Supabase configuration is present and protected.
- [x] AWS temporary CLI authentication works.
- [x] GitHub authentication works.
- [x] Vercel authentication works.
- [x] No secret value appears in terminal output, Git, or documentation.

## Phase 0 — Discovery and repository foundation

- [x] Inspect files, Git state, runtimes, package managers, Docker, and CLIs.
- [x] Preserve existing user work and record constraints.
- [x] Initialize Git if needed and configure the plandelta-ai repository name.
- [x] Create pnpm workspace and Turborepo configuration.
- [x] Create apps/web, apps/api, apps/vision, packages/contracts, packages/ui,
      packages/config, infrastructure, samples, and docs structure.
- [x] Add root scripts, editor settings, ignores, formatters, linters, and
      environment validation strategy.
- [x] Add Docker Compose skeleton and service health checks.
- [x] Write the first README sections: problem, status, architecture, setup.
- [x] Run install, lint, typecheck, tests, and build for the skeleton.
- [x] Commit in small verified foundation commits.

Exit gate:

- [x] A fresh install succeeds and the root quality commands exist.
- [x] No secret or generated build output is tracked.
- [x] PHASES.md reflects the real state.

## Phase 1 — Product shell and design system

- [x] Implement design tokens from docs/DESIGN_SYSTEM.md.
- [x] Build responsive marketing entry page with a direct sample-demo action.
- [x] Build application shell and routes for project list, new project,
      project detail, and analysis workspace.
- [x] Build blueprint workbench layout with fixture data: revision rail,
      canvas, comparison controls, change ledger, filters, and detail panel.
- [x] Add pan, zoom, fit, overlay opacity, before/after, and synchronized view.
- [x] Add loading, empty, failure, and reduced-motion states.
- [x] Verify keyboard navigation, focus visibility, and mobile fallbacks.
- [x] Add component and visual smoke tests.

Exit gate:

- [x] The fixture-driven journey is polished and responsive.
- [x] No generic placeholder dashboard or fake live analysis remains.
- [x] Web lint, typecheck, tests, and production build pass.

## Phase 2 — Supabase schema, migrations, and authentication

- [x] Implement schema from docs/DATABASE.md with Prisma and SQL where RLS or
      database functions require it.
- [x] Add Supabase Auth integration and JWT verification boundaries.
- [x] Add clean-database migrations, indexes, constraints, and RLS policies.
- [x] Add seed data for one demo account/project without real credentials.
- [x] Add database client lifecycle and transaction helpers.
- [x] Add durable job claim/lease behavior using row locking.
- [x] Test migration up from an empty database and seed idempotency.
- [x] Document local and hosted Supabase setup.

Exit gate:

- [x] Fresh migration and seed succeed when credentials are available.
- [x] Cross-user access tests fail safely.
- [x] No service-role key is exposed to the browser.

## Phase 3 — NestJS API and worker

- [x] Implement API modules for health, auth context, projects, revisions,
      analyses, changes, reports, and storage.
- [x] Implement validation, consistent errors, pagination, and correlation IDs.
- [x] Generate Swagger/OpenAPI docs.
- [x] Implement LocalStorageProvider with safe paths and atomic writes.
- [x] Implement multipart uploads with MIME, size, and ownership validation.
- [x] Implement durable PostgreSQL job queue, leasing, heartbeat, retry, and
      stale-job recovery.
- [x] Create a separate worker entry point from the API process.
- [x] Add service and integration tests.

Exit gate:

- [x] API tests pass against a clean test database.
- [x] Two workers cannot process the same claimed job.
- [x] Restarting a worker does not silently lose queued work.
- [x] OpenAPI reflects the implemented contract.

## Phase 4 — FastAPI vision pipeline

- [x] Implement typed request/result models from docs/API_CONTRACT.md.
- [x] Add health/readiness endpoints and engine version reporting.
- [x] Validate input paths/URLs, bytes, formats, page selection, and limits.
- [x] Implement PDF rendering and image normalization.
- [x] Implement alignment with quality metrics and safe fallbacks.
- [x] Implement directional diff, morphology, region extraction, merging, and
      normalized coordinates.
- [x] Implement crop-level PaddleOCR and text comparison.
- [x] Implement deterministic category and affected-trade rules.
- [x] Save overlay, evidence crops, debug metrics, and structured result.
- [x] Add golden tests for unchanged, translated, annotated, added-wall,
      removed-door, text-change, rotation, and invalid-input fixtures.
- [x] Benchmark a representative sample on CPU.

Exit gate:

- [x] The committed sample produces stable evidence-based regions.
- [x] An unchanged pair produces no material changes within tolerance.
- [x] Bad alignment is reported, not disguised as a confident result.
- [x] Pytest and formatting pass.

## Phase 5 — End-to-end local product

- [x] Connect upload, revision selection, analysis creation, worker, FastAPI,
      persistence, progress, retry, and result retrieval.
- [x] Use Supabase Realtime where reliable and polling as a resilient fallback.
- [x] Implement the built-in sample through the real pipeline or clearly use a
      committed precomputed result paired with a Run fresh analysis option.
- [x] Render real overlay geometry and evidence in React Konva.
- [x] Implement change filters, selection, old/new text, confidence, metrics,
      and affected trades.
- [x] Implement deterministic executive summary and printable report.
- [x] Add failure recovery and retry from the UI.
- [x] Run the critical Playwright journey.

Exit gate — local release:

- [x] A clean local setup completes upload through report.
- [x] Built-in sample works for a reviewer.
- [x] Root lint, typecheck, test, E2E, and build pass.
- [x] Docker Compose services become healthy.
- [x] README setup and troubleshooting are accurate.

## Phase 6 — PyTorch and ONNX evidence classifier

- [x] Define a narrow changed-region classification task and dataset contract.
- [x] Generate or curate non-sensitive labelled blueprint crops.
- [x] Train a small CPU-sensible PyTorch model with reproducible seed/config.
- [x] Export the selected checkpoint to ONNX.
- [x] Validate PyTorch and ONNX output parity.
- [x] Benchmark ONNX inference and integrate it behind a feature flag.
- [x] Compare it against deterministic rules on a committed validation set.
- [x] Use the model by default only if it improves measured classification.
- [x] Document dataset limits, metrics, model card, and reproduction commands.

Exit gate:

- [x] Model artifacts are versioned appropriately without bloating Git.
- [x] ONNX inference is tested and failures fall back transparently to rules.
- [x] Claims in README match measured results.

## Phase 7 — Hardening, documentation, and local release candidate

- [x] Audit accessibility, responsiveness, performance, and error copy.
- [x] Add rate limits, upload quotas, cleanup policy, and request timeouts.
- [x] Add structured logs, redaction, health checks, and job observability.
- [x] Add architecture diagram, product screenshots, API examples,
      limitations, and security notes to README/docs.
- [x] Add GitHub Actions for web, API, vision, E2E smoke, and secret scanning.
- [x] Run dependency and container vulnerability checks; resolve material
      findings.
- [x] Run fresh-clone setup rehearsal.
- [x] Run secret scan and inspect full Git history.
- [ ] Create GitHub repository plandelta-ai and push verified commits.

Exit gate:

- [ ] Public repository is portfolio ready and contains no secrets.
- [ ] CI passes on the default branch.
- [ ] Local release tag and changelog are accurate.

## Phase 8 — Vercel frontend deployment

- [ ] Connect the GitHub repository to Vercel.
- [ ] Configure non-secret and secret environment variables.
- [ ] Configure production API URL, allowed image sources, and CORS contract.
- [ ] Deploy and inspect build logs.
- [ ] Test landing, demo entry, authentication boundary, and error states.
- [ ] Record the verified frontend URL in README.

Exit gate:

- [ ] Vercel deployment is public, responsive, and free of console errors.
- [ ] No server-only credential appears in the client bundle.

## Phase 9 — AWS storage and AI providers

Begin only after the local release gate passes.

- [ ] Implement S3StorageProvider using presigned operations and least
      privilege.
- [ ] Implement BedrockSummaryProvider with a strict JSON schema, evidence-only
      prompt, timeouts, cost limits, and deterministic fallback.
- [ ] Keep model ID and region configurable.
- [ ] Add provider contract tests with mocked AWS calls.
- [ ] Provision development bucket, lifecycle rules, CORS, encryption, public
      access block, and IAM role.
- [ ] Verify upload, analysis read, artifact write, report read, and cleanup.
- [ ] Record actual service-region availability and credit eligibility.
- [ ] Create AWS Budget notifications at $10, $15, $20, and $25.
- [ ] Confirm there is no NAT Gateway, load balancer, RDS, ElastiCache,
      OpenSearch, SageMaker endpoint, EKS, ECS/Fargate, or provisioned Bedrock.

Exit gate:

- [ ] AWS providers pass integration checks without public objects.
- [ ] Bedrock failure does not prevent an analysis report.
- [ ] No long-lived AWS key is committed or sent to the browser.

## Phase 10 — AWS container deployment

- [ ] Build production images for Nest API/worker and FastAPI vision service.
- [ ] Push images to ECR with immutable version tags.
- [ ] Provision one t3.small with 20 GB gp3, T3 CPU credit mode standard, one
      worker, 2 GB swap, and an IAM instance role.
- [ ] Use lightweight OCR models, lazy loading, container memory limits, and
      worker concurrency one.
- [ ] Resize temporarily to t3.medium only after a recorded t3.small memory
      failure; record the reason and reverse when no longer needed.
- [ ] Deploy API, worker, vision, and reverse proxy with Docker Compose.
- [ ] Add TLS, health checks, restart policies, resource limits, and shared
      configuration.
- [ ] Send structured logs to CloudWatch with retention limits.
- [ ] Restrict security groups and administrative access.
- [ ] Configure Vercel production origin and Supabase production settings.
- [ ] Run a complete deployed sample analysis.
- [ ] Configure AWS budget alerts and document expected spend.
- [ ] Capture actual Cost Explorer/Billing totals without exposing account
      identifiers.

Exit gate:

- [ ] Public API health endpoint passes over HTTPS.
- [ ] Full Vercel-to-AWS-to-Supabase-to-S3 flow is verified.
- [ ] Container restart and failed-job recovery are verified.
- [ ] Actual spend remains below the $25 target or is explicitly explained.

## Phase 11 — Final portfolio handoff and resource review

- [ ] Polish README headline, feature media, architecture, live demo, stack,
      technical decisions, benchmarks, limitations, and setup.
- [ ] Add concise resume bullets and interview talking points.
- [ ] Verify every documented command and link.
- [ ] Ensure issue templates, license, changelog, and release notes exist.
- [ ] Ask the user whether live AWS processing should remain available. If not,
      terminate EC2 and its attached EBS volume, release paid IPv4 allocation,
      remove temporary CloudWatch logs, and clean unused ECR images.
- [ ] Keep only minimal private S3/ECR evidence if its monthly cost is
      negligible and its retention is intentional; otherwise remove it.
- [ ] Verify the Vercel app still presents the labelled precomputed sample and
      explains that live processing is temporarily offline.
- [ ] Record resource status and final actual/forecast AWS spend.
- [ ] Create final small commits and release tag.
- [ ] Record live URLs, test results, cloud resources, spend guardrails, and
      teardown procedure.

Final gate:

- [ ] All required phases pass or external blockers are explicitly documented.
- [ ] Repository and Vercel sample are usable; AWS deployment verification is
      documented even if temporary compute has been torn down.
- [ ] The product never overstates estimation accuracy or hides uncertainty.
