# PlanDelta AI v0.2 — Agentic Execution Phases

Execute sequentially. Check an item only when source or recorded evidence exists. Focused checks may
run during implementation; the complete repository verification and repair loop runs after all
features are integrated.

Continue automatically from one phase to the next. Do not stop at phase exit gates, commits, pushes,
partial demos, local success, or deployment. Record small meaningful Conventional Commits after
coherent progress and at least one per phase; large phases should use multiple commits by concern.
Stop only when every final gate passes, except for a genuine external blocker that prevents all
remaining safe work.

## Current execution state

- Current phase: Phase 17 — NestJS conversation API and durable execution
- Current task: Implement owned conversation/message/run APIs, isolated durable agent leases, and
  resumable safe event delivery
- Starting main commit: `8a5cd34c2452db3537128b53dc30cf73affbd2b3`
- Working branch: `feat/agentic-v0.2`, created from the starting main commit
- Stable tag to preserve: annotated `v0.1.0` at `11bdca3600491f01424175292e829208663f0955`
- Verified baseline (2026-07-19): public GitHub repository and release present; latest main CI run
  `29642023602` passed; Supabase database/Auth reachable; public Vercel landing and AWS API
  readiness returned HTTP 200
- Runtime baseline: Node 22.16.0, pnpm 11.9.0, Python 3.12.10, Docker 29.6.1, Docker Compose 5.3.0,
  15.68 GiB host memory, 181.21 GiB free disk
- AWS audit (2026-07-19): non-root `plandelta` IAM identity verified in `us-east-1`; one running
  `t3.small` with one encrypted 20 GiB `gp3` volume; `$25` monthly budget with `$0.103` recorded
  spend; bounded Amazon Nova Micro runtime invocation passed
- Active blockers: none
- Last completed implementation checkpoint: Phase 14 typed provider/runtime foundation, redacted
  telemetry, cancellation/timeout controls, and the internal non-root container are verified
- Phase 15 checkpoint: authorized PDF/TXT knowledge upload, validation, private storage, pending
  version/job creation, source access, retry, deletion, and focused API coverage pass
- Phase 15 RAG checkpoint: deterministic extraction/chunking, bounded Vision OCR fallback, local BGE
  embeddings, transactional activation, filtered hybrid retrieval, clean migration replay, and a
  real temporary Supabase ingestion/search/cleanup journey pass
- Phase 15 versioning checkpoint: per-version private storage, same-identity reuse, atomic
  replacement, stale/conflicting opt-in retrieval, and full-prefix deletion pass in focused and real
  Supabase checks
- Phase 15 completion (2026-07-19): authenticated document register, validation/upload, version
  replacement, real polled progress, safe failure codes, retry/deletion, desktop/mobile layouts,
  clean migration replay, database boundaries, real Supabase RAG replacement journey,
  repository-wide tests, lint, typecheck, and production builds pass
- Phase 16 completion (2026-07-19): guarded intake, dynamic supervisor routing, three allowlisted
  read-only specialists, parallel fan-out, schema-constrained grounded synthesis, independent
  citation/freshness/conflict verifier, one repair edge, safe fallback, hard
  tool/model/token/time/cost bounds, redacted node/tool traces, durable trace sink, and 55 active
  agent tests pass
- Agent/RAG status: typed workspace and shared Zod contracts pass; additive Supabase pgvector,
  knowledge, conversation, run, step, citation, RLS, and hybrid-search migrations are applied and
  verified
- Deployment policy: Reuse current cost-controlled runtime; no new paid service
- Final verification status: Not started

## Phase 12 — Baseline, branch, and v0.2 contract

- [x] Read every existing and v0.2 instruction/documentation file.
- [x] Inspect worktree, remotes, tags, latest commits, CI, releases, live resource status, and
      current cost without modifying v0.1.0.
- [x] Verify existing Supabase, GitHub, Vercel, and temporary AWS access without printing secret
      values.
- [x] Verify current v0.1.0 sample and record any pre-existing failure.
- [x] Create or resume `feat/agentic-v0.2` from current `main`.
- [x] Copy the v0.2 pack into the repository, retaining the completed original `PHASES.md` as
      historical evidence.
- [x] Reconcile package versions and confirm Python/Node resource constraints.
- [x] Add root commands for agent development, lint, typecheck, test, eval, and Docker lifecycle.
- [x] Update architecture documentation with the planned agent service and data flows.
- [x] Commit the v0.2 execution contract separately from implementation.

Implementation checkpoint:

- [x] v0.1.0 history/tag is unchanged and the v0.2 branch is clean.
- [x] No secret or cloud mutation occurred during planning.

## Phase 13 — Additive database model and shared contracts

- [x] Enable `vector` through a versioned, reversible Supabase migration.
- [x] Add `analysisProfile` to projects/analyses with `construction_drawing` as the
      backward-compatible default.
- [x] Add knowledge document, document version, chunk, and ingestion-job models.
- [x] Add conversation, message, agent-run, agent-step, and citation models.
- [x] Persist source revision, page, section, checksum, chunker version, embedding model,
      active/stale status, and authorization scope.
- [x] Add HNSW/IVFFlat only after confirming the supported Supabase/pgvector version and dataset
      scale; add full-text indexes regardless.
- [x] Add a project-scoped hybrid-search database function with explicit limits.
- [x] Add constraints preventing cross-project citations and duplicate active chunks for the same
      document version/checksum.
- [x] Add RLS for every new user-owned table and service-role-only worker paths.
- [x] Add shared Zod/Pydantic-compatible schemas for chat, run events, tools, specialist packets,
      answers, citations, RFI drafts, ingestion, and domain profiles.
- [x] Update OpenAPI/internal contracts without breaking v0.1 routes.
- [x] Add clean-database, migration, RLS, and conflict fixture coverage for the final verification
      phase.
- [x] Commit schema and contracts in separate coherent commits.

Implementation checkpoint:

- [x] Existing records map to the construction profile without data loss.
- [x] Every agent/retrieval record can be traced to an owner and project.

## Phase 14 — Agent service foundation

- [x] Create `apps/agent` as a typed FastAPI service with health/readiness.
- [x] Add strict environment validation and internal service authentication.
- [x] Add Bedrock chat-model provider behind an interface.
- [x] Add deterministic/fake provider implementations for tests and local failure behavior; never
      present them as live AI.
- [x] Add local embedding provider behind an interface with recorded model and dimension.
- [x] Keep optional Bedrock embeddings disabled by default.
- [x] Define typed graph state, run context, evidence packet, citation, answer, verifier result, and
      safe-error schemas.
- [x] Add correlation IDs, timeouts, cancellation, and redacted structured event logging.
- [x] Add Dockerfile, resource limits, Compose service, and NestJS readiness integration.
- [x] Ensure the service is lightweight when idle and lazy-loads embedding resources.
- [x] Commit the service foundation before agent behavior.

Implementation checkpoint:

- [x] Browser cannot reach the internal agent service directly.
- [x] No prompt/document/message content appears in service logs.

## Phase 15 — Document ingestion and hybrid RAG

- [x] Implement authorized supporting-document upload through NestJS and the storage-provider
      boundary.
- [x] Validate MIME signature, size, page count, checksum, ownership, and safe filenames.
- [x] Implement text extraction for supported PDFs with OCR fallback only when necessary and
      bounded.
- [x] Chunk by document structure/page with deterministic overlap and stable identifiers.
- [x] Generate local embeddings with batching, timeout, memory, and length limits.
- [x] Persist chunks transactionally and mark previous versions stale/inactive.
- [x] Implement project-scoped hybrid vector/full-text retrieval.
- [x] Add metadata filters for active version, revision/effective date, document type, page, and
      analysis profile.
- [x] Detect and preserve conflicting records; never silently select a winner.
- [x] Produce citation-ready results containing source, page, section, excerpt, score components,
      checksum, and revision metadata.
- [x] Add deletion/re-ingestion cleanup and idempotency.
- [x] Add ingestion status UI and safe error/retry states.
- [x] Commit ingestion and retrieval separately.

Implementation checkpoint:

- [x] A supported document becomes searchable without a paid embedding API.
- [x] Stale and cross-project chunks are excluded.

## Phase 16 — Load-bearing multi-agent graph

- [x] Implement intake/input guard and authorized context construction.
- [x] Implement supervisor intent classification and specialist selection.
- [x] Implement Visual Evidence Agent with only analysis/change/artifact tools.
- [x] Implement Knowledge Agent with only hybrid-search/source-page tools.
- [x] Implement Impact Agent with evidence, configured profile rules, quantity helpers, and
      RFI-draft schema.
- [x] Implement candidate-answer synthesis from structured specialist packets.
- [x] Implement mandatory Verifier Agent for claims, citations, scope, conflicts, revision
      freshness, and uncertainty.
- [x] Add one verifier-driven repair edge and a hard terminal fallback.
- [x] Ensure simple visual questions do not invoke RAG unnecessarily.
- [x] Ensure document-only questions do not invoke CV tools unnecessarily.
- [x] Enforce maximum turns, specialists, tool calls, chunks, tokens, duration, repair passes, and
      cost estimate.
- [x] Persist graph node transitions and summarized tool events without hidden chain-of-thought or
      private content.
- [x] Add deterministic graph fixtures for routing, parallelizable specialists, verifier rejection,
      repair, timeout, and loop termination.
- [x] Commit each specialist/tool group and the final graph separately.

Implementation checkpoint:

- [x] Source and traces prove dynamic routing and real tool use.
- [x] An answer cannot complete without verifier approval or safe fallback.

## Phase 17 — NestJS conversation API and durable execution

- [ ] Add project/analysis conversation CRUD with ownership enforcement.
- [ ] Add message creation, run creation, status, retry, cancel, and history endpoints.
- [ ] Add SSE for safe node/status/tool-summary/final events.
- [ ] Do not stream model chain-of-thought, raw prompts, or document bodies.
- [ ] Integrate the agent service through internal authenticated requests.
- [ ] Extend the durable queue with separate ingestion/agent job types or an equivalently isolated
      lease path.
- [ ] Add idempotency keys so retries do not duplicate messages or citations.
- [ ] Add heartbeats, expiry, maximum attempts, cancellation, stale-run recovery, and transactional
      final persistence.
- [ ] Add per-user/project daily message and token/cost quotas plus concurrency one for the AWS
      demo.
- [ ] Add audit events and correlation IDs across web, API, agent, database, and Bedrock.
- [ ] Preserve the existing analysis worker throughput and routes.

Implementation checkpoint:

- [ ] API restart and agent-service restart do not lose or duplicate a run.
- [ ] Cross-user conversation and citation access fail safely.

## Phase 18 — Evidence Copilot experience

- [ ] Add a responsive Evidence Copilot panel to the analysis workspace.
- [ ] Add evidence-aware suggested questions.
- [ ] Implement streaming status, cancel, retry, reconnect, empty, loading, partial, refusal,
      conflict, error, and quota states.
- [ ] Render only sanitized supported Markdown.
- [ ] Render typed visual and document citation components.
- [ ] Clicking a visual citation selects/focuses the existing React Konva region and corresponding
      ledger entry.
- [ ] Clicking a document citation opens an authorized source preview at the page/section or shows a
      safe excerpt when preview is unavailable.
- [ ] Add structured, editable RFI draft presentation with explicit human review and no send action.
- [ ] Add keyboard navigation, focus management, screen-reader labels, mobile layout, and
      reduced-motion behavior.
- [ ] Keep existing comparison and report interactions usable when chat is collapsed or unavailable.
- [ ] Add clearly labelled cached sample questions/answers without exposing an unlimited
      unauthenticated Bedrock route.

Implementation checkpoint:

- [ ] Citations link answer text to the correct visible evidence.
- [ ] The assistant never appears available when live compute is offline.

## Phase 19 — Analysis profiles and second domain

- [ ] Define typed `AnalysisProfile` registry and configuration contract.
- [ ] Move construction-specific category, affected-trade, vocabulary, prompt, and impact rules
      behind the construction profile without changing its current verified behavior.
- [ ] Implement the `engineering_schematic` profile with component, connection/line, label, note,
      dimension, and unknown categories.
- [ ] Add profile selection at project creation and display it throughout the workspace/report/chat
      context.
- [ ] Prevent profile changes after incompatible evidence exists unless a safe
      re-analysis/re-ingestion path is used.
- [ ] Commit a non-sensitive baseline/candidate schematic fixture, expected change regions,
      supporting document, grounded questions, and citations.
- [ ] Add a clearly labelled public cached schematic sample.
- [ ] Document mechanical drawing and packaging artwork only as future profiles unless fully
      verified during this phase.

Implementation checkpoint:

- [ ] Construction golden behavior remains within existing tolerance.
- [ ] The schematic sample completes comparison, retrieval, and cited chat.

## Phase 20 — Guardrails, observability, evaluations, and cost controls

- [ ] Implement the policies in `docs/GUARDRAILS_V0_2.md` at code boundaries.
- [ ] Add prompt-injection fixtures inside OCR text and supporting documents.
- [ ] Add wrong-revision, stale-document, conflicting-record, malformed-tool, missing-artifact,
      cross-project, and Bedrock-outage fixtures.
- [ ] Create the versioned evaluation dataset and runner.
- [ ] Record routing, evidence recall, citation validity/precision, unsupported-claim, conflict,
      refusal, tool-count, latency, token, and cost metrics.
- [ ] Establish documented release thresholds before reading final scores; do not tune thresholds
      merely to pass.
- [ ] Add redacted run trace inspection and authorized debug view or CLI.
- [ ] Add CloudWatch metrics/alarms for failures, latency, tool loops, token use, estimated spend,
      queue depth, and invalid citations.
- [ ] Add authenticated rate limits and public-sample abuse protection.
- [ ] Verify one run cannot exceed configured tool/model/cost limits.
- [ ] Document limitations and distinguish curated/synthetic evaluation from field accuracy.

Implementation checkpoint:

- [ ] The important failure modes have executable tests and trace evidence.
- [ ] No private content is present in logs or evaluation artifacts.

## Phase 21 — Complete verification and mandatory repair loop

- [ ] Freeze feature work and execute every item in `docs/FINAL_VERIFICATION_V0_2.md` from a clean
      state.
- [ ] Run clean migrations and seeds, not only incremental migrations.
- [ ] Run formatting, lint, strict typecheck, all unit/service/integration tests, agent evaluations,
      E2E, production builds, Docker builds, and health checks.
- [ ] Run the complete original blueprint upload-to-report regression.
- [ ] Run supporting-document ingestion through cited answer and RFI draft.
- [ ] Run the engineering-schematic journey.
- [ ] Run cross-user, prompt-injection, conflict, stale-record, wrong-revision, tool-loop, timeout,
      retry, cancellation, restart, and quota tests.
- [ ] Run accessibility, responsive, reduced-motion, and browser-console checks.
- [ ] Run dependency, container, secret, staged-diff, and full-history scans.
- [ ] For every failure, fix the underlying issue and rerun the smallest check.
- [ ] After any fix, rerun the entire final matrix from the beginning.
- [ ] Repeat until all required checks pass together.
- [ ] Record exact commands, commit SHA, dataset version, metrics, limitations, duration, and
      resource use.

Exit gate:

- [ ] No required test is skipped, weakened, quarantined, or deleted to pass.
- [ ] Repository is clean and every required local gate passes in one final run.

## Phase 22 — Cost-controlled deployment and v0.2 handoff

- [ ] Measure current EC2 memory/disk/CPU before adding the agent container.
- [ ] Build and push immutable agent/API/vision release images.
- [ ] Update the existing Compose/CloudFormation deployment without prohibited services or duplicate
      always-on environments.
- [ ] Add only the minimum new SSM configuration and IAM permissions.
- [ ] Verify local embeddings and agent concurrency one fit the current runtime; resize only after
      recorded failure and within the existing policy.
- [ ] Apply production migrations safely and verify RLS.
- [ ] Deploy backend and then Vercel changes.
- [ ] Run authenticated production ingestion-to-cited-chat smoke test.
- [ ] Verify clickable citations, schematic sample, report regression, quota, public sample, offline
      state, logs, alarms, and cleanup.
- [ ] Capture actual/forecast AWS cost and ensure the existing teardown gate is still active.
- [ ] Populate `docs/APPLICATION_EVIDENCE_V0_2.md` from final source and tests.
- [ ] Update README, architecture, operations, security, testing, limitations, screenshots, API
      docs, changelog, and release notes.
- [ ] Run final CI, merge the reviewed branch, tag `v0.2.0`, and publish the release only after
      every gate passes.
- [ ] Recheck deployed public paths after the release commit.

Final gate:

- [ ] Repository history is intact, CI is green, deployment claims are true, citations are
      inspectable, evaluation results are reproducible, and the application evidence document
      matches the source.
