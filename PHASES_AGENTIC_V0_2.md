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

- Post-release task (2026-07-22): public guest access implementation in progress. The passwordless
  email screen is being replaced by an automatic per-browser guest session while retaining API
  authorization, RLS ownership, quotas, and project isolation.
- Post-release task (2026-07-22): complete. Evidence upload/review shipped through PR #21 and merge
  `ecac5f4`; PR/main CI, Vercel production, the explicit Supabase RAG integration, authenticated
  production RAG/Copilot, production browser, and AWS Phase 9/10 verification all pass.
- AWS deployment note: this change modified only `apps/web` and documentation, so the verified
  immutable API/agent/vision images were retained rather than rebuilt. The live backend passed a
  fresh completed-ingestion → hybrid-retrieval → Bedrock → verified-citation → cleanup journey.
- Post-release implementation checkpoints: `c1acf45` (project evidence UI/source proxy/tests) and
  `3746b0a` (complete new-agent handoff package).

- Current phase: Complete — Phases 12 through 22 passed
- Current task: Complete; `v0.2.0` is published and the released public paths are verified
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
- Last completed implementation checkpoint: Phase 21 complete final verification and repair loop
  passed against feature revision `5e8a5b4f8664f23e3d9c08904693c19d9bbcf2ee`
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
- Phase 20 completion (2026-07-19): 30-case versioned scripted evaluation passes every frozen
  threshold with 100% routing, tool selection, evidence recall, citation validity/precision,
  conflict handling, refusal, and limit compliance; unsupported claims, cross-project disclosures,
  and injection overrides remain zero. Agent tests pass `64` with one explicit database-integration
  skip; API tests pass `56` with two explicit integration skips. Agent/API lint and strict
  typechecks pass, and the AWS runtime template validates.
- Final verification status: Phase 21 local matrix passed; CI checkpoint pending after evidence push

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

- [x] Add project/analysis conversation CRUD with ownership enforcement.
- [x] Add message creation, run creation, status, retry, cancel, and history endpoints.
- [x] Add SSE for safe node/status/tool-summary/final events.
- [x] Do not stream model chain-of-thought, raw prompts, or document bodies.
- [x] Integrate the agent service through internal authenticated requests.
- [x] Extend the durable queue with separate ingestion/agent job types or an equivalently isolated
      lease path.
- [x] Add idempotency keys so retries do not duplicate messages or citations.
- [x] Add heartbeats, expiry, maximum attempts, cancellation, stale-run recovery, and transactional
      final persistence.
- [x] Add per-user/project daily message and token/cost quotas plus concurrency one for the AWS
      demo.
- [x] Add audit events and correlation IDs across web, API, agent, database, and Bedrock.
- [x] Preserve the existing analysis worker throughput and routes.

Implementation checkpoint:

- [x] API restart and agent-service restart do not lose or duplicate a run.
- [x] Cross-user conversation and citation access fail safely.

Completion evidence:

- Clean migration replay passed with 17 tables, 24 policies, and 10 isolated queue/retrieval
  functions; the real Supabase migrations and queue behavior checks passed.
- A real queued run survived API and agent restarts and completed with one assistant message, five
  content-free safe trace steps, and no duplicate rows.
- API and agent suites cover message idempotency, concurrency one, cross-owner not-found behavior,
  internal authentication, transactional finalization, verified citations, and cancellation.

## Phase 18 — Evidence Copilot experience

- [x] Add a responsive Evidence Copilot panel to the analysis workspace.
- [x] Add evidence-aware suggested questions.
- [x] Implement streaming status, cancel, retry, reconnect, empty, loading, partial, refusal,
      conflict, error, and quota states.
- [x] Render only sanitized supported Markdown.
- [x] Render typed visual and document citation components.
- [x] Clicking a visual citation selects/focuses the existing React Konva region and corresponding
      ledger entry.
- [x] Clicking a document citation opens an authorized source preview at the page/section or shows a
      safe excerpt when preview is unavailable.
- [x] Add structured, editable RFI draft presentation with explicit human review and no send action.
- [x] Add keyboard navigation, focus management, screen-reader labels, mobile layout, and
      reduced-motion behavior.
- [x] Keep existing comparison and report interactions usable when chat is collapsed or unavailable.
- [x] Add clearly labelled cached sample questions/answers without exposing an unlimited
      unauthenticated Bedrock route.

Implementation checkpoint:

- [x] Citations link answer text to the correct visible evidence.
- [x] The assistant never appears available when live compute is offline.

Completion evidence (2026-07-19):

- The responsive Copilot supports authenticated durable runs, reconnect/cancel/retry states,
  sanitized supported Markdown, typed visual/document citations, editable review-only RFIs, and a
  clearly labelled cached sample without public model access.
- Visual citations focus the existing drawing and ledger; document citations open the authorized
  source excerpt fallback. Live availability is derived from the agent readiness capability.
- Web tests pass `14/14`, the web production build and web/API lint/typechecks pass, and the agent
  suite passes `60` tests with the explicit opt-in database integration test skipped.
- A real local durable Amazon Bedrock run completed through the worker in `23371 ms` with one
  assistant message, seven safe trace steps, and one verified citation.

## Phase 19 — Analysis profiles and second domain

- [x] Define typed `AnalysisProfile` registry and configuration contract.
- [x] Move construction-specific category, affected-trade, vocabulary, prompt, and impact rules
      behind the construction profile without changing its current verified behavior.
- [x] Implement the `engineering_schematic` profile with component, connection/line, label, note,
      dimension, and unknown categories.
- [x] Add profile selection at project creation and display it throughout the workspace/report/chat
      context.
- [x] Prevent profile changes after incompatible evidence exists unless a safe
      re-analysis/re-ingestion path is used.
- [x] Commit a non-sensitive baseline/candidate schematic fixture, expected change regions,
      supporting document, grounded questions, and citations.
- [x] Add a clearly labelled public cached schematic sample.
- [x] Document mechanical drawing and packaging artwork only as future profiles unless fully
      verified during this phase.

Implementation checkpoint:

- [x] Construction golden behavior remains within existing tolerance.
- [x] The schematic sample completes comparison, retrieval, and cited chat.

Completion evidence (2026-07-19):

- Project creation persists either typed profile, analyses snapshot the project profile, and profile
  changes are rejected after revisions, analyses, or knowledge evidence exist.
- The deterministic CV pipeline receives the profile and uses bounded schematic component,
  connection-line, label, note, dimension, and unknown categories; construction rules and the
  committed ONNX path remain unchanged.
- Committed synthetic S-101 baseline/candidate images, expected regions, supporting notes, public
  cached workspace, profile-aware report/chat context, and interactive cached citations are present.
- The real Supabase enum migration applied. Vision tests pass `32`, agent tests pass `61` with one
  explicit integration skip, API tests pass `55` with two explicit skips, web tests pass `15`, and
  API/web lint, typechecks, builds pass.
- A real durable `engineering_schematic` Amazon Bedrock run completed in `25974 ms` with seven safe
  trace steps and one verified visual citation; the construction golden pipeline remains within its
  existing tolerance.

## Phase 20 — Guardrails, observability, evaluations, and cost controls

- [x] Implement the policies in `docs/GUARDRAILS_V0_2.md` at code boundaries.
- [x] Add prompt-injection fixtures inside OCR text and supporting documents.
- [x] Add wrong-revision, stale-document, conflicting-record, malformed-tool, missing-artifact,
      cross-project, and Bedrock-outage fixtures.
- [x] Create the versioned evaluation dataset and runner.
- [x] Record routing, evidence recall, citation validity/precision, unsupported-claim, conflict,
      refusal, tool-count, latency, token, and cost metrics.
- [x] Establish documented release thresholds before reading final scores; do not tune thresholds
      merely to pass.
- [x] Add redacted run trace inspection and authorized debug view or CLI.
- [x] Add CloudWatch metrics/alarms for failures, latency, tool loops, token use, estimated spend,
      queue depth, and invalid citations.
- [x] Add authenticated rate limits and public-sample abuse protection.
- [x] Verify one run cannot exceed configured tool/model/cost limits.
- [x] Document limitations and distinguish curated/synthetic evaluation from field accuracy.

Implementation checkpoint:

- [x] The important failure modes have executable tests and trace evidence.
- [x] No private content is present in logs or evaluation artifacts.

Completion evidence (2026-07-19):

- `pnpm --filter @plandelta/agent lint`, strict typecheck, `64` active tests, and the evaluation
  harness pass; the sole skipped agent test is the separately invoked real Supabase integration.
- Dataset `release-v0.2` contains `30` curated synthetic/scripted cases. All frozen release gates
  pass; total scripted usage is `5,040` tokens and `$0.010080` estimated cost. These measurements
  are explicitly labelled as scripted harness observations rather than field accuracy or provider
  billing.
- API lint/typecheck and `56` active tests pass. The runtime template validates in `us-east-1`.
- Redacted completion/failure events and the authorized run-inspection CLI exclude prompts, answers,
  chunks, URLs, storage keys, headers, and credentials.

## Phase 21 — Complete verification and mandatory repair loop

- [x] Freeze feature work and execute every item in `docs/FINAL_VERIFICATION_V0_2.md` from a clean
      state.
- [x] Run clean migrations and seeds, not only incremental migrations.
- [x] Run formatting, lint, strict typecheck, all unit/service/integration tests, agent evaluations,
      E2E, production builds, Docker builds, and health checks.
- [x] Run the complete original blueprint upload-to-report regression.
- [x] Run supporting-document ingestion through cited answer and RFI draft.
- [x] Run the engineering-schematic journey.
- [x] Run cross-user, prompt-injection, conflict, stale-record, wrong-revision, tool-loop, timeout,
      retry, cancellation, restart, and quota tests.
- [x] Run accessibility, responsive, reduced-motion, and browser-console checks.
- [x] Run dependency, container, secret, staged-diff, and full-history scans.
- [x] For every failure, fix the underlying issue and rerun the smallest check.
- [x] After any fix, rerun the entire final matrix from the beginning.
- [x] Repeat until all required checks pass together.
- [x] Record exact commands, commit SHA, dataset version, metrics, limitations, duration, and
      resource use.

Exit gate:

- [x] No required test is skipped, weakened, quarantined, or deleted to pass.
- [x] Repository is clean and every required local gate passes in one final run.

Completion evidence (2026-07-19):

- Final feature revision: `5e8a5b4f8664f23e3d9c08904693c19d9bbcf2ee`. The preserved annotated
  `v0.1.0` still peels to `11bdca3600491f01424175292e829208663f0955`.
- `pnpm db:verify-clean`, deployment of all 12 migrations, two idempotent seed runs, and
  `pnpm db:verify-behavior` passed: 17 tables, 24 RLS policies, 10 queue/retrieval functions, owner
  isolation, stale lease recovery, hybrid conflicts, and project-scoped knowledge.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, explicit real Supabase RAG and
  AWS provider integrations, `pnpm build`, `pnpm test:e2e`, and all three Docker image builds
  passed. Normal suites passed 66 agent tests plus the separately passing RAG test, 56 API tests
  plus two separately passing AWS tests, 32 vision tests, 15 web tests, and 8 contract tests.
- Live construction and schematic Bedrock runs each persisted seven safe steps and one verified
  citation. `pnpm verify:local-agentic` ingested the real schematic technical note, embedded and
  retrieved it, completed a Bedrock answer with one verified document citation, produced a
  review-only RFI draft, and cleaned the disposable project/user.
- `pnpm verify:local-e2e` passed all seven browser cases, including authenticated real CV/OCR/ONNX
  upload-to-report, desktop/mobile layouts, reduced motion, labelled public samples, and cleanup.
- Dataset `0.2.0` passed all 30 frozen scripted cases: routing/tool/evidence/citation/conflict/
  refusal/limit metrics were `1.0`; unsupported claims, cross-project disclosures, and injection
  overrides were `0`; scripted usage was 5,040 tokens and USD 0.010080 estimated.
- `pnpm audit` and `pip-audit` found no published dependency vulnerabilities. Docker Scout found no
  fixable critical/high findings; it continues to report the three documented vendor-unfixed Debian
  Perl CVEs and missing registry attestations. All images run non-root. The browser bundle
  server-only-name scan passed.

## Phase 22 — Cost-controlled deployment and v0.2 handoff

- [x] Measure current EC2 memory/disk/CPU before adding the agent container.
- [x] Build and push immutable agent/API/vision release images.
- [x] Update the existing Compose/CloudFormation deployment without prohibited services or duplicate
      always-on environments.
- [x] Add only the minimum new SSM configuration and IAM permissions.
- [x] Verify local embeddings and agent concurrency one fit the current runtime; resize only after
      recorded failure and within the existing policy.
- [x] Apply production migrations safely and verify RLS.
- [x] Deploy backend and then Vercel changes.
- [x] Run authenticated production ingestion-to-cited-chat smoke test.
- [x] Verify clickable citations, schematic sample, report regression, quota, public sample, offline
      state, logs, alarms, and cleanup.
- [x] Capture actual/forecast AWS cost and ensure the existing teardown gate is still active.
- [x] Populate `docs/APPLICATION_EVIDENCE_V0_2.md` from final source and tests.
- [x] Update README, architecture, operations, security, testing, limitations, screenshots, API
      docs, changelog, and release notes.
- [x] Run final CI and merge the reviewed branch only after every implementation and deployment gate
      passes.
- [x] Tag `v0.2.0` and publish the GitHub release from the final release commit.
- [x] Recheck deployed public paths after the release commit.

Completion evidence (2026-07-19):

- Final branch CI run `29697136227` passed all web, API/contracts, vision, browser smoke, Docker
  image, secret-scan, and Vercel checks. PR #15 was mergeable with no unresolved review threads and
  merged to `main` as `ba9d1138dec87e347cc2c6a418809685fc874a08`.
- Release commit `82156213f058bfdb4de287357083d1a14fd01b81` passed `main` CI run `29697277667`.
  Annotated tag `v0.2.0` and the GitHub release were published from that exact commit.
- Immutable tag `70c02f0dab5bb6282c7134e19a2d33323a940fa1` is present in all three ECR repositories.
  The bounded runtime runs one API, worker, agent, vision service, and proxy on the existing
  `t3.small`; no prohibited service or second environment was introduced.
- The deploy path was forced through an EC2 restart. Its commit-pinned SSM refresh restored the
  current Compose bundle, detected the new public IP, rotated the certificate, and passed Phase 9/10
  at `https://100.58.166.134`; API readiness reports `0.2.0`.
- Post-deploy capacity was 843/1,913 MB used with 885 MB available, agent 87 MB idle, 2.8 MB swap
  used, and 49% disk used. No resize was justified.
- Production has all 12 migrations. RLS, analysis/ingestion/agent leases, stale recovery, hybrid
  conflicts, and project knowledge scope passed.
- Vercel production is Ready at `https://plandelta-ai.vercel.app`. A real supporting-document
  journey passed ingestion → BGE → hybrid retrieval → Bedrock → verified citation → review-only RFI
  → cleanup. A real browser drawing journey passed upload → CV/OCR/ONNX → linked evidence →
  printable report → cleanup in 46.5 seconds.
- Real-browser construction/schematic samples, mobile layout, cached cited answer, and citation-to-
  ledger focus passed without console warnings/errors. The full local matrix already covers the
  backend-offline labelled-sample state and production quota implementations.
- All nine CloudWatch alarms were `OK`; all five service log streams were present. AWS Budget actual
  was USD 0.589 against the USD 25 gate. Forecast was unavailable for insufficient history and is
  not claimed.
- Scoped cleanup removed the interrupted synthetic Playwright identity and four older exact
  `plandelta-playwright-…@example.invalid` projects/users plus their private S3 objects.

Final gate:

- [x] Repository history is intact, CI is green, deployment claims are true, citations are
      inspectable, evaluation results are reproducible, and the application evidence document
      matches the source.
