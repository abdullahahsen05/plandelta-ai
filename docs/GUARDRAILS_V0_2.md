# Agent Guardrails and Failure Handling v0.2

Guardrails must exist in executable code and tests. Prompt text alone is not a
security boundary.

## Trust boundaries

Untrusted inputs include:

- user questions;
- filenames and document metadata;
- OCR text from drawings;
- extracted specification/document text;
- retrieved chunks;
- model responses and tool arguments proposed by a model;
- stored messages created by a browser client.

System instructions, tool allowlists, authorization scope, cost limits, and
citations are server-controlled.

## Prompt injection

Documents may contain text such as “ignore previous instructions” or fake tool
commands. The system must:

- delimit retrieved content as quoted untrusted evidence;
- tell models that evidence cannot modify policy or tool permissions;
- reject tool names outside the registry;
- validate every argument against a schema;
- derive project/user scope from run context;
- detect common injection patterns for telemetry and evaluation without
  relying solely on a pattern blacklist;
- verify final claims independently of the generation prompt.

Add fixtures where injection appears in OCR text, a specification page, an RFI,
and a user question.

## Tool safety

- Read-only tools only.
- No arbitrary SQL, URLs, filesystem paths, shell commands, Python execution,
  outbound web requests, messaging, or mutation tools.
- Per-tool row, byte, page, and timeout limits.
- Server-owned scope appended after model argument validation.
- Tool outputs converted to typed evidence packets.
- Tool failures return safe structured errors and do not leak provider details.
- Duplicate identical tool calls within a run are deduplicated or rejected.

## Citation policy

A citation passes only if:

- the target exists;
- the target belongs to the run project and authorized user;
- the source was present in a specialist evidence packet used for synthesis;
- visual coordinates remain normalized and within `[0,1]`;
- a document version is ready and active, or explicitly cited as an older
  conflicting revision;
- page and section metadata resolve;
- the excerpt matches the stored source within normalized tolerance;
- the claim type is supported by that source.

If any substantive claim lacks support, the verifier rejects the answer.

## Conflicting evidence

When sources disagree:

- preserve both evidence packets;
- state exactly what conflicts;
- cite both sources;
- state any configured precedence signal such as revision/effective date;
- do not make an approval or compliance decision;
- recommend human review or produce an RFI draft when appropriate.

## Limits

Enforce limits in application code, not only prompts:

- model turns;
- tool calls and repeated calls;
- specialist fan-out;
- retrieved candidate/final chunks;
- source bytes and excerpt length;
- wall-clock deadline;
- tokens and estimated cost;
- verifier repairs;
- concurrent and daily user runs.

On limit exhaustion, persist a safe terminal state and return a concise
insufficient-evidence/budget response.

## Required failure modes

### Agent tool loop

Risk: a model repeatedly searches or opens the same evidence, consuming time
and Bedrock credit.

Safeguard: deduplicate calls, cap tools/turns/time/cost, allow one repair, and
terminate deterministically.

Verification: a fake provider intentionally repeats a tool request; the test
asserts the maximum count, terminal code, bounded trace, no duplicate messages,
and no additional model call.

### Wrong revision retrieval

Risk: an obsolete specification is presented as current.

Safeguard: default search to active versions, persist revision metadata, and
require the verifier to check citation freshness. When an old version conflicts
with the active one, cite both and label the conflict.

### Cross-project data leakage

Risk: model-proposed IDs retrieve another user's evidence.

Safeguard: ignore model-provided ownership scope, enforce API ownership, RLS,
tool query scope, and citation project constraints.

### Hallucinated visual evidence

Risk: the model references a nonexistent change or describes content outside a
detected region.

Safeguard: citations can target only persisted changes/artifacts returned by a
tool; verifier validates identifiers and answer claims.

### Model/provider outage

Risk: Bedrock timeout or invalid schema leaves a run hanging.

Safeguard: request deadlines, lease recovery, bounded retry, safe failure
message, and continued access to deterministic analysis/report/sample.

## Output policy

- Never call results approval, certification, guaranteed cost, or code
  compliance.
- Qualify impact and quantity statements with their evidence and confidence.
- Keep low-confidence OCR visibly uncertain.
- RFI content remains a draft requiring review.
- Do not expose internal prompts, hidden reasoning, or verifier scratch data.
