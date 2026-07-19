# Agentic Application Evidence v0.2

Do not complete this with planned paths or unverified claims. Populate it only
after the final source, history, tests, traces, and deployment are complete.

## Repository

- Public repository URL:
- Stable release/tag:
- Commit SHA reviewed:
- CI run:
- Optional git bundle command/link:

## Load-bearing source paths

For each final path, state exactly what it does and link to the source:

### Orchestration and control flow

- Supervisor/router:
- Graph definition:
- Graph state:
- Specialist nodes:
- Verifier/repair/fallback:

### Durable state

- Database schema/migrations:
- Agent run/message repositories:
- Queue lease/recovery:
- SSE/event persistence:

### Tools and retrieval

- Tool registry and authorization:
- Visual evidence tools:
- Document ingestion/chunking:
- Embeddings and hybrid retrieval:
- Conflict handling:
- Citation resolution:

### Guardrails and failure handling

- Input/prompt-injection boundary:
- Tool limits and budgets:
- Citation validator:
- Timeout/cancellation/fallback:

### Tests and evaluations

- Unit/integration tests:
- Evaluation dataset/runner:
- Golden construction and schematic fixtures:
- Final evaluation results:

### Logging and observability

- Trace event schema:
- Redaction:
- CloudWatch metrics/alarms:

If any requested category does not exist, say so directly.

## Data ingestion and bad/conflicting records

Describe:

- supported data and where ingestion occurs;
- how chunks/embeddings/source metadata are persisted;
- one exact bad record fixture;
- one exact conflicting revision fixture;
- how the system marks stale/failed records;
- how retrieval and the verifier handle the conflict;
- the test/evaluation proving the behavior.

## Important failure mode

Use one failure with executable evidence. Recommended primary example:

> An agent repeatedly requested the same retrieval tool, risking latency and
> Bedrock credit exhaustion.

Document:

- what caused or could cause it;
- detection signal and trace event;
- duplicate-call, tool/turn/time/token/cost, and repair limits;
- safe terminal response;
- exact test path/case and observed result;
- commit that added the safeguard.

If a more meaningful real failure occurs during development, use that instead
and retain the regression evidence.

## Honest limitations

Include at least:

- no approval/compliance guarantee;
- deterministic CV dependence on alignment/document quality;
- curated evaluation set is not field accuracy;
- one verified second domain is not arbitrary-image support;
- temporary single-instance AWS runtime and Bedrock dependence;
- RAG may miss poorly extracted or ambiguous source text;
- human review remains required.
