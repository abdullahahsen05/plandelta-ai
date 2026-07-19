# Agent Observability and Cost Controls v0.2

## Trace events

Persist and log redacted events for:

- run queued/claimed/started/completed/failed/cancelled/expired;
- supervisor route result and reason code;
- specialist start/end;
- tool name/version start/end and safe result count;
- verifier pass/reject and reason codes;
- repair attempt;
- model/provider call latency, token counts, and estimated cost;
- quota/budget rejection;
- citation validation counts;
- ingestion extraction/chunk/embedding progress.

Do not log raw questions, complete answers, prompts, OCR text, document chunks,
signed URLs, storage keys, authorization headers, database URLs, or secrets.

## Correlation

Carry a server-generated correlation ID across Next.js request metadata,
NestJS, durable job, agent graph, Bedrock calls, database events, and CloudWatch.
Also record run ID, project-safe opaque ID, node name, attempt, and event
sequence where useful.

## Metrics

- queued/running/completed/failed agent runs;
- ingestion queue depth/failure;
- p50/p95 run latency;
- model calls and tokens;
- estimated Bedrock cost per run/day;
- tool calls and duplicate-tool blocks;
- retrieved chunks;
- verifier rejection/repair/fallback rates;
- invalid citation attempts;
- prompt-injection detections;
- quota/budget denials;
- agent/vision/API container CPU and memory.

## Cost policy

- Existing project target: less than USD 25 total AWS spend.
- Existing alerts at USD 10/15/20/25 remain active.
- Use on-demand Bedrock only.
- Default local embeddings; no new paid vector/embedding vendor.
- Authenticated live questions only.
- One concurrent AWS agent run.
- Per-run model/tool/token/time/cost limits.
- Per-user daily live-question and estimated-cost limits.
- Cached public sample answers.
- Record actual pricing assumptions/configuration at deployment time because
  model pricing can change.

## Deployment capacity gate

Before adding the agent container:

1. record current EC2 available memory, swap use, disk, CPU, and container
   limits under an analysis run;
2. build and measure the idle agent service;
3. run local embedding ingestion and one agent run at concurrency one;
4. confirm the existing `t3.small` remains healthy;
5. tune lazy loading and limits first;
6. resize temporarily only after a repeatable recorded failure and within the
   existing budget policy.

Do not add managed infrastructure to solve an unmeasured local resource issue.

## Alarms

Add bounded alerts or operational checks for:

- agent failure/timeout surge;
- queue age/depth;
- verifier/citation failure surge;
- token/cost threshold;
- EC2 memory/swap/disk pressure;
- unhealthy agent readiness;
- Bedrock throttling/unavailability.

Use short log retention consistent with the existing deployment.
