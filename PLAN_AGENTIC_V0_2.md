# PlanDelta AI v0.2 — Agentic Product and Engineering Plan

## Product statement

PlanDelta AI is an evidence-grounded revision-intelligence agent for technical documents. It
combines deterministic visual change detection with project knowledge retrieval and bounded agent
orchestration so reviewers can ask what changed, why it matters, and which source evidence supports
the answer.

Construction drawing review remains the flagship experience. v0.2 also proves the platform boundary
with one engineering-schematic profile. It does not claim to understand arbitrary images.

## Primary user story

As an estimator or technical reviewer, I compare two revisions, add the relevant specification and
change documents, ask a question in the same workspace, receive a concise evidence-grounded answer,
inspect every citation, see uncertainty or conflicts, and optionally generate a reviewable RFI
draft.

## Portfolio objective

The v0.2 source must answer the recruiter evaluation directly:

- orchestration/control flow is explicit and load-bearing;
- state handling is durable and inspectable;
- tool and retrieval calls are real and authorized;
- guardrails and failure handling are tested;
- evaluations are reproducible and committed;
- structured traces show what ran without exposing private content or hidden reasoning;
- data ingestion, bad records, conflicts, and one important failure mode are documented honestly;
- development history remains intact and understandable.

## User-facing capabilities

### Evidence Copilot

- Project- and analysis-scoped conversational panel.
- Streaming progress events, not hidden chain-of-thought.
- Suggested questions based on available evidence.
- Markdown-safe answer rendering.
- Visual citations linked to change regions and artifacts.
- Document citations linked to source document, revision, page, and excerpt.
- Conflict and insufficient-evidence states.
- Structured RFI draft with an explicit human review state.
- Conversation history, retry, cancellation, and accessible error recovery.

### Project knowledge

Accepted supporting documents for v0.2:

- PDF specifications;
- drawing notes and revision narratives;
- addenda;
- BOQs/schedules exported to PDF or text-readable formats already supported by the chosen parser;
- RFIs and prior reports.

Document limits must be configurable and documented. Unsupported formats must fail clearly rather
than being stored as successfully searchable.

### Analysis profiles

Required profiles:

1. `construction_drawing` — preserves the v0.1.0 behavior and vocabulary.
2. `engineering_schematic` — supports line/component/connection/label/note and unknown change
   categories with one committed golden sample.

The architecture may list mechanical drawing and packaging artwork as future profiles, but do not
claim them as supported without fixtures, evaluation, and UI verification.

## Bounded multi-agent workflow

Use LangGraph or an equally explicit typed graph inside `apps/agent`.

1. Intake validates the request and builds authorized context.
2. Supervisor classifies intent and selects only the necessary specialists.
3. Visual Evidence Agent retrieves deterministic analysis findings.
4. Knowledge Agent performs hybrid project-document retrieval.
5. Impact Agent connects evidence to configured domain impact rules and may produce an RFI draft
   schema.
6. Synthesizer creates a candidate answer from specialist evidence packets.
7. Verifier checks claims, IDs, citations, revision scope, conflicts, and uncertainty.
8. One bounded repair pass may run after a verifier rejection.
9. Finalizer returns a verified answer or a safe insufficient-evidence result.

Specialists return structured evidence packets. They do not write directly to the user or perform
side effects.

## RAG strategy

- Store metadata and chunks in Supabase PostgreSQL.
- Enable `pgvector` through an additive migration.
- Combine PostgreSQL full-text ranking with vector similarity.
- Filter every query by authorized project ID, current document status, selected revision/effective
  date, and optional document type.
- Use a local embedding provider by default so local development requires no paid API.
- Store embedding model and chunker versions with every chunk.
- Preserve source document, page, section, offsets, checksum, and revision metadata for citations
  and re-ingestion.
- Mark old chunks inactive during version replacement; do not let stale chunks remain silently
  searchable.
- Detect records that appear to address the same subject but disagree. Return both and label the
  conflict rather than choosing one silently.

## API and state strategy

- NestJS owns public chat routes and authorization.
- The browser receives conversation/run updates through NestJS SSE.
- Agent service accepts only internal authenticated calls with scoped IDs.
- PostgreSQL stores the durable conversation, message, agent run, step, tool call summary, citation,
  and ingestion states.
- User-visible messages store final content and citations, not private hidden reasoning.
- Agent runs are idempotent and retryable. A retry cannot duplicate a user message or citations.
- The existing analysis queue is not blocked by chat work. Use separate job types or a separate
  concurrency-controlled queue path.

## Safety strategy

- Evidence-only response policy.
- Prompt-injection filtering at ingestion and tool-result boundaries.
- Read-only allowlisted tools.
- Strict schemas for plans, specialist outputs, citations, answers, and RFI drafts.
- Maximum model turns, tool calls, retrieved chunks, run duration, token budget, cost estimate,
  repair count, and concurrent runs.
- Project ownership checked before each tool call, not only at request entry.
- No arbitrary SQL, filesystem access, shell execution, web browsing, external messaging, or
  document mutation.
- Human review required before any RFI is exported or copied as final work.
- Deterministic insufficient-evidence fallback when Bedrock is disabled, unavailable, invalid, or
  over budget.

## Evaluation strategy

Commit a non-sensitive evaluation dataset covering:

- direct visual questions;
- document-only questions;
- questions requiring both visual evidence and RAG;
- affected-trade and impact questions;
- RFI drafting;
- conflicting document revisions;
- stale records;
- unrelated documents;
- prompt injection embedded in OCR or documents;
- cross-project citation attempts;
- unknown or unsupported questions;
- tool-loop and timeout behavior;
- both required analysis profiles.

Measure at least:

- intent/routing accuracy;
- required evidence recall;
- citation validity and citation precision;
- unsupported-claim rate;
- conflict-detection success;
- safe-refusal success;
- tool-call count;
- latency;
- token use and estimated Bedrock cost.

Do not claim production accuracy from a small synthetic or curated set.

## Technical choices

- Web: existing Next.js/React/Tailwind/React Konva stack.
- Public API and durable jobs: existing NestJS/Prisma stack.
- Agent: Python 3.12, FastAPI, typed Pydantic models, LangGraph, AWS Bedrock Converse provider, and
  provider fakes for tests.
- Retrieval: Supabase PostgreSQL, `pgvector`, PostgreSQL full-text search, and a local CPU-sensible
  sentence-transformer/ONNX embedding provider.
- Vision: existing OpenCV/PaddleOCR/PyTorch/ONNX pipeline unchanged except for analysis-profile
  inputs and compatible category mapping.
- Infrastructure: existing Vercel and cost-controlled EC2/S3/ECR/Bedrock stack.

## Explicit non-goals

- Generic web-search assistant.
- Arbitrary photo understanding.
- Automatic construction approval or code-compliance certification.
- Sending emails, RFIs, Slack messages, or external actions.
- Long-term personal memory across unrelated projects.
- Teams, billing, subscriptions, mobile applications, or a marketplace.
- Fine-tuning a foundation model.
- New managed vector databases or always-on AI endpoints.

## Release gates

The final local gate requires the complete v0.1.0 regression, new RAG and agent tests, new E2E
journeys, evaluation thresholds, Docker health, clean migrations, secret scanning, and production
builds to pass together.

The deployment gate requires authenticated live chat, correct citation links, one production agent
run, quotas, cost telemetry, public-sample protection, CloudWatch traces, and unchanged
budget/teardown controls.
