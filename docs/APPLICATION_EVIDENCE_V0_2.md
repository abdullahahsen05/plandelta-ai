# Agentic Application Evidence v0.2

This record maps the deployed v0.2 implementation to reviewable source, executable tests, persisted
evidence, and verified production behavior. It does not claim field accuracy or automatic
engineering approval.

## Repository

- Public repository: <https://github.com/abdullahahsen05/plandelta-ai>
- Preserved stable release: [`v0.1.0`](https://github.com/abdullahahsen05/plandelta-ai/releases/tag/v0.1.0)
- Reviewed v0.2 branch: [`feat/agentic-v0.2`](https://github.com/abdullahahsen05/plandelta-ai/tree/feat/agentic-v0.2)
- Verified deployment checkpoint: `904335b6eb0b2c72b6e94bb555acb3d401ac76a9`
- Green CI run:
  <https://github.com/abdullahahsen05/plandelta-ai/actions/runs/29694008103>
- Draft review:
  <https://github.com/abdullahahsen05/plandelta-ai/pull/15>

The final merge SHA, `v0.2.0` tag, and release URL are added only after the reviewed branch and
post-deployment gates pass.

## Load-bearing source paths

### Orchestration and control flow

- Supervisor/router:
  [`apps/agent/plandelta_agent/agents/supervisor.py`](../apps/agent/plandelta_agent/agents/supervisor.py)
  produces schema-bounded specialist selections; the model cannot name arbitrary agents or tools.
- Graph definition:
  [`apps/agent/plandelta_agent/graph/workflow.py`](../apps/agent/plandelta_agent/graph/workflow.py)
  builds the bounded LangGraph workflow, deadline handling, repair path, fallback, and trace.
- Graph state:
  [`packages/contracts/src/agentic.ts`](../packages/contracts/src/agentic.ts) and
  [`apps/agent/plandelta_agent/models/state.py`](../apps/agent/plandelta_agent/models/state.py)
  define the serializable public/run state without hidden reasoning.
- Specialist nodes:
  [`apps/agent/plandelta_agent/agents/specialists.py`](../apps/agent/plandelta_agent/agents/specialists.py)
  implements visual, knowledge, and impact specialists over the same scoped tool registry.
- Verifier/repair/fallback:
  [`apps/agent/plandelta_agent/graph/verifier.py`](../apps/agent/plandelta_agent/graph/verifier.py)
  rejects unsupported, stale, cross-project, and one-sided conflict citations; the workflow permits
  at most one repair before a safe insufficient-evidence response.

### Durable state

- Database schema/migrations:
  [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) plus the versioned
  [`20260719000100_agentic_data_model`](../apps/api/prisma/migrations/20260719000100_agentic_data_model/migration.sql),
  [`20260719000700_versioned_knowledge_storage`](../apps/api/prisma/migrations/20260719000700_versioned_knowledge_storage/migration.sql),
  and
  [`20260719000800_agentic_durable_queues`](../apps/api/prisma/migrations/20260719000800_agentic_durable_queues/migration.sql)
  migrations provide pgvector knowledge, conversations, messages, runs, citations, events, jobs,
  leases, and RLS.
- Agent run/message repositories:
  [`apps/api/src/agentic/conversations.service.ts`](../apps/api/src/agentic/conversations.service.ts)
  creates idempotent messages/runs; the agent
  [`PostgresGraphResultSink`](../apps/agent/plandelta_agent/graph/persistence.py) atomically persists
  verified messages, citations, usage, and redacted trace metadata.
- Queue lease/recovery:
  [`apps/api/src/agentic/agentic-queue.service.ts`](../apps/api/src/agentic/agentic-queue.service.ts)
  claims one durable agent or ingestion job at a time and recovers expired leases.
- SSE/event persistence:
  [`apps/api/src/agentic/agent-runs.controller.ts`](../apps/api/src/agentic/agent-runs.controller.ts)
  resumes typed server-sent events from durable sequence IDs instead of relying on process memory.

### Tools and retrieval

- Tool registry and authorization:
  [`apps/agent/plandelta_agent/tools/registry.py`](../apps/agent/plandelta_agent/tools/registry.py)
  validates schemas, allowed specialist roles, time/result limits, duplicate calls, and server-owned
  project scope.
- Visual evidence tools:
  [`apps/agent/plandelta_agent/tools/implementations.py`](../apps/agent/plandelta_agent/tools/implementations.py)
  reads normalized detected changes and authorized visual artifacts.
- Document ingestion/chunking:
  [`apps/agent/plandelta_agent/ingestion/processor.py`](../apps/agent/plandelta_agent/ingestion/processor.py),
  [`extraction.py`](../apps/agent/plandelta_agent/ingestion/extraction.py), and
  [`chunking.py`](../apps/agent/plandelta_agent/ingestion/chunking.py) extract bounded PDF/text/image
  sources and persist structural chunks with source metadata.
- Embeddings and hybrid retrieval:
  [`apps/agent/plandelta_agent/providers/local_embeddings.py`](../apps/agent/plandelta_agent/providers/local_embeddings.py)
  runs local BGE embeddings; [`retrieval.py`](../apps/agent/plandelta_agent/retrieval.py) calls the
  project-scoped PostgreSQL full-text/pgvector hybrid search.
- Conflict handling:
  [`apps/agent/plandelta_agent/ingestion/repository.py`](../apps/agent/plandelta_agent/ingestion/repository.py)
  versions active and superseded sources and returns inactive conflicts only with an explicit
  revision filter.
- Citation resolution:
  [`apps/api/src/agentic/citations.service.ts`](../apps/api/src/agentic/citations.service.ts)
  resolves only owner-authorized visual/document targets; the web
  [`Evidence Copilot`](../apps/web/components/evidence-copilot/evidence-copilot.tsx) focuses drawing
  regions or opens a safe source excerpt.

### Guardrails and failure handling

- Input/prompt-injection boundary:
  [`apps/agent/plandelta_agent/guardrails/input_policy.py`](../apps/agent/plandelta_agent/guardrails/input_policy.py)
  detects instruction/tool/exfiltration language inside untrusted OCR and documents; fixtures live
  in [`apps/agent/evals/fixtures`](../apps/agent/evals/fixtures).
- Tool limits and budgets:
  [`apps/agent/plandelta_agent/guardrails/budgets.py`](../apps/agent/plandelta_agent/guardrails/budgets.py)
  caps specialists, unique tools, retrieved chunks, model turns, time, tokens, estimated cost, and
  repair passes.
- Citation validator:
  [`apps/agent/plandelta_agent/graph/verifier.py`](../apps/agent/plandelta_agent/graph/verifier.py)
  requires every citation to match returned evidence, project scope, source state, geometry, and
  conflict policy before publication.
- Timeout/cancellation/fallback:
  [`apps/agent/plandelta_agent/execution.py`](../apps/agent/plandelta_agent/execution.py) cancels
  active operations; the workflow converts bounded failures into typed terminal states and safe
  user-facing responses.

### Tests and evaluations

- Unit/integration tests:
  [`apps/agent/tests`](../apps/agent/tests),
  [`apps/api/src`](../apps/api/src), [`apps/web/test`](../apps/web/test), and
  [`apps/web/e2e`](../apps/web/e2e) cover routing, authorization, RLS, queues, retry/cancellation,
  citations, chat UI, real uploads, reports, and service boundaries.
- Evaluation dataset/runner:
  [`release-v0.2.jsonl`](../apps/agent/evals/datasets/release-v0.2.jsonl),
  frozen [`thresholds-v0.2.json`](../apps/agent/evals/thresholds-v0.2.json), and
  [`evaluation.py`](../apps/agent/plandelta_agent/evaluation.py).
- Golden construction and schematic fixtures:
  [`samples/vision`](../samples/vision) and [`samples/schematic`](../samples/schematic), including
  expected geometry, supporting notes, and prompt-injection fixtures.
- Final evaluation results:
  [`release-v0.2.md`](../apps/agent/evals/results/release-v0.2.md) records 30/30 passing curated
  cases, 100% routing/evidence/citation/conflict/refusal gates, zero unsupported claims,
  cross-project disclosures, or injection overrides, 5,040 scripted tokens, and USD 0.010080
  estimated scripted cost. These are harness results, not field accuracy or provider billing.

### Logging and observability

- Trace event schema:
  [`apps/agent/plandelta_agent/models/traces.py`](../apps/agent/plandelta_agent/models/traces.py) and
  [`graph/workflow.py`](../apps/agent/plandelta_agent/graph/workflow.py) persist bounded routing,
  tool, verification, outcome, usage, and duration facts.
- Redaction:
  [`apps/agent/plandelta_agent/telemetry.py`](../apps/agent/plandelta_agent/telemetry.py) excludes
  prompts, answers, chunks, headers, URLs, and storage keys from log metadata.
- CloudWatch metrics/alarms:
  [`infrastructure/aws/runtime.yaml`](../infrastructure/aws/runtime.yaml) defines failure, latency,
  tool-loop, token, estimated-spend, queue-depth, invalid-citation, quota, instance-status, and CPU
  credit controls. All nine deployed alarms were `OK` on 2026-07-19.

## Data ingestion and bad/conflicting records

Supported knowledge inputs are bounded PDF, TXT, Markdown, PNG, JPG, and JPEG files. The NestJS
knowledge controller validates ownership and upload metadata, stores the source through the
local/S3 interface, and queues ingestion. The agent service extracts bounded text or vision OCR,
chunks by structural headings with overlap, embeds through local
`BAAI/bge-small-en-v1.5` vectors, and persists source page/section, checksum, parser, chunker,
embedding, revision, active/stale, and conflict metadata in Supabase pgvector.

`apps/agent/evals/fixtures/spec-injection.txt` is the exact bad-record fixture: text embedded in a
purported specification asks the model to reveal prompts and ignore evidence policy. The input
policy marks it untrusted and the `prompt-injection-document-01` evaluation proves it causes zero
instruction overrides or disclosures.

`conflict-current-old-01` in `release-v0.2.jsonl` is the exact conflicting revision fixture. Active
and obsolete chunks share a conflict key but retain revision/effective-date state. Normal search
does not silently use stale chunks; explicit conflict retrieval returns both, synthesis labels the
answer `conflicting_evidence`, and the verifier requires citations to both sides. The real Supabase
integration in `test_rag_database_integration.py` verifies the active/stale filter and explicit
conflict path.

Failed extraction/embedding records receive a safe failure code; superseded versions remain
inactive and auditable. Neither failed nor stale records are silently promoted into ordinary
retrieval.

## Important failure mode: repeated retrieval loop

A model or specialist could request the same retrieval tool and arguments repeatedly, increasing
latency and consuming Bedrock credit without adding evidence. `RunBudget.reserve_tool` hashes the
tool name plus validated canonical arguments. A repeated fingerprint raises
`AGENT_DUPLICATE_TOOL_CALL`; unique calls still stop at the tool cap. The same budget enforces
specialist, model-turn, timeout, retrieved-chunk, total-token, estimated-cost, and one-repair limits.

The tool registry records only a safe failed invocation/error code, while graph persistence records
the bounded terminal outcome and counters. No partial answer is published: the workflow returns a
safe typed fallback requiring the user to narrow the request or review source evidence.

Executable evidence is
`test_budget_deduplicates_tools_and_caps_model_tokens` in
[`apps/agent/tests/test_guardrails_routing.py`](../apps/agent/tests/test_guardrails_routing.py) and
the `tool-loop-duplicate-01` frozen evaluation case. Both passed in the Phase 21 final matrix.
The guard entered history in commit `caf0484` (`feat(agent): add guarded routing and tool policy`);
the scripted safety-evaluation regression followed in `737e42c`.

## Verified production evidence

- Vercel production: <https://plandelta-ai.vercel.app>
- AWS API at verification time: `https://44.200.227.167`
- Runtime: one `t3.small`, encrypted 20 GB gp3, 2 GB swap, one worker, agent concurrency one,
  private S3, on-demand Nova Micro, and no prohibited managed services.
- Immutable deployed image tag: `89bae3071e5dd6530f28ff4e1c83c98a38974fbd` in agent, API, and vision ECR
  repositories.
- AWS Phase 9/10 verifiers passed after a forced EC2 restart and automatic public-IP certificate
  rotation.
- Post-deploy memory: 1,913 MB total, 843 MB used, 885 MB available; agent 87 MB idle; swap 2.8 MB;
  disk 9.8/20 GB (49%).
- A real production technical-note journey completed ingestion, local BGE embedding, hybrid
  retrieval, Bedrock synthesis, one verified citation, review-only RFI, and cleanup.
- A real production browser journey completed authenticated two-drawing upload, deterministic
  CV/OCR/ONNX analysis, linked evidence/crop, printable report, and cleanup in 38 seconds.
- Public construction and schematic samples, mobile layout, cached cited answer, and citation-to-
  ledger focus were checked in a real browser with no console warning/error.
- AWS Budget actual was USD 0.589 against the USD 25 gate. Cost Explorer was still lagging and AWS
  returned `DataUnavailableException` for forecast due insufficient history; no forecast is
  fabricated.

## Honest limitations

- PlanDelta is decision support, not approval, compliance, cost, quantity, or constructability
  certification.
- Deterministic CV accuracy depends on drawing alignment, scan quality, scale, OCR quality, and the
  visibility of the revision.
- The curated synthetic/scripted evaluation set measures regressions and guardrail behavior, not
  field accuracy.
- Construction drawings and one verified engineering-schematic profile do not imply support for
  arbitrary images, mechanical drawings, or packaging artwork.
- Live processing uses a temporary single-instance AWS runtime. An instance restart changes its
  public IP and requires the automated runtime/Vercel refresh; the labelled samples remain useful
  if live compute is stopped.
- Live synthesis depends on on-demand Bedrock availability. Deterministic drawing evidence remains
  available without it.
- RAG can miss poorly extracted, ambiguous, scanned, mislabeled, or stale source text.
- Every finding, citation, impact note, and RFI draft requires qualified human review before action.
