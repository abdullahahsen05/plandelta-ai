# Agent Evaluations v0.2

## Purpose

Evaluations must prove that the system retrieves and cites the correct project
evidence, routes to the appropriate specialists, stops safely, and avoids
unsupported claims. They are not a marketing benchmark.

## Dataset structure

Keep a versioned, non-sensitive dataset under `apps/agent/evals/datasets/`.
Each case should contain:

- stable case ID and dataset version;
- analysis profile;
- project/analysis/document fixture references;
- user question;
- expected intent and required/forbidden specialists;
- expected/forbidden tool names;
- required evidence IDs or source-section matchers;
- expected conflict/refusal behavior;
- allowed answer concepts, prohibited claims, and required warnings;
- maximum model turns/tool calls/chunks;
- deterministic tags such as visual, RAG, combined, injection, conflict,
  authorization, failure, or RFI.

Do not commit private customer drawings, emails, or credentials.

## Minimum evaluation groups

1. Construction visual evidence.
2. Construction specification retrieval.
3. Combined drawing/spec impact reasoning.
4. Engineering-schematic visual and document questions.
5. RFI drafting.
6. Conflicting current/obsolete records.
7. Unrelated and insufficient evidence.
8. OCR/document prompt injection.
9. Cross-project identifier attempts.
10. Tool-loop, timeout, cancellation, and Bedrock failure.

Use enough cases to make per-category metrics meaningful. Prefer at least 30
well-reviewed cases over hundreds of weak synthetic prompts.

## Metrics

- Routing accuracy: required/forbidden specialist decisions.
- Tool selection accuracy.
- Required evidence recall.
- Citation validity: target exists, authorized, used, and resolves.
- Citation precision: cited sources actually support adjacent claims.
- Unsupported-claim rate.
- Conflict-detection and stale-revision success.
- Safe-refusal success.
- RFI schema validity and required disclaimer.
- Mean/p95 tool calls and latency.
- Token use and estimated Bedrock cost.
- Loop/timeout termination compliance.

## Release thresholds

Set thresholds in the repository before final measured runs. Recommended
starting requirements:

- 100% citation target validity;
- 0 cross-project disclosures;
- 0 successful prompt-injection policy overrides;
- 100% loop/timeout termination within configured limits;
- 100% required conflict cases visibly report the conflict;
- 100% required insufficient-evidence cases avoid unsupported factual claims;
- at least 90% routing/tool selection on the curated dataset;
- at least 90% required evidence recall;
- no substantive unsupported claims in release-blocking cases.

If these are unrealistic after inspecting the dataset, change them before the
final scoring run and document why. Never lower them after seeing failures
solely to publish a pass.

## Test modes

### Deterministic mode

Use scripted/fake model providers to exercise every graph edge, retry, limit,
and failure path. This mode runs in CI and cannot require AWS credentials.

### Live Bedrock mode

Run a small, bounded subset after deterministic tests pass. Record model ID,
prompt version, dataset version, timestamp, latency, token use, estimated cost,
and nondeterministic limitations. Do not require live Bedrock for every pull
request.

## Evaluation output

Generate machine-readable JSON plus a concise committed Markdown release
summary. Do not commit full private prompts or chunks. Include per-case pass
status, reason codes, source IDs, and metrics needed to reproduce claims.

## Regression policy

Every fixed agent failure gets a minimal regression case. Do not overwrite the
original failure evidence. Record which commit introduced the safeguard and the
command that verifies it.

## v0.2 release assets

- Dataset: `apps/agent/evals/datasets/release-v0.2.jsonl` (30 curated synthetic cases).
- Frozen thresholds: `apps/agent/evals/thresholds-v0.2.json`.
- Deterministic runner: `pnpm --filter @plandelta/agent eval`.
- Committed result: `apps/agent/evals/results/release-v0.2.json` and `.md`.
- Focused failure fixtures: `apps/agent/evals/fixtures/`.

The deterministic dataset uses scripted synthetic outputs to exercise routing, evidence/citation
accounting, conflicts, refusals, prompt injection, authorization, and bounded failures. Its latency,
token, and estimated-cost fields are scripted harness measurements, not production performance or
actual Bedrock billing. These scores are regression gates and do not measure field accuracy.
