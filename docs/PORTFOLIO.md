# Portfolio handoff

## One-line product story

PlanDelta is an evidence-first construction drawing revision workspace that
aligns two blueprint revisions, detects visual and textual changes with a real
OpenCV/OCR pipeline, and keeps every conclusion traceable to source geometry,
crops, confidence, and engine version.

## Resume bullets

- Built an end-to-end construction blueprint revision product with Next.js,
  NestJS, FastAPI, Supabase PostgreSQL/Auth, OpenCV, PaddleOCR, ONNX, S3,
  Bedrock, CloudWatch, Vercel, and AWS CloudFormation.
- Designed a durable PostgreSQL job queue with row locking, leases, heartbeat,
  retry, stale-job recovery, idempotency, and a single concurrency-controlled
  production worker.
- Implemented deterministic PDF/image normalization, feature alignment,
  directional differencing, morphology, OCR comparison, normalized evidence,
  and a confidence-gated ONNX classifier with a visible rules fallback.
- Shipped a cost-controlled AWS runtime on one `t3.small` with encrypted gp3,
  2 GB swap, IMDSv2, SSM-only access, private S3 artifacts, short-retention
  logs, and gross-cost alerts under a USD 25 target.
- Verified local and deployed upload-to-report journeys, private artifact
  access, worker/API restart recovery, natural retry exhaustion and recovery,
  clean migrations, cross-user RLS isolation, CI, and full-history secret
  scanning.

## Interview talking points

### Why deterministic vision before generative AI?

Construction reviewers need evidence, not fluent guesses. OpenCV and OCR
produce normalized regions, crops, alignment metrics, and text deltas that can
be reviewed directly. Bedrock is limited to an evidence-only summary and a
strict schema; invalid output falls back to the deterministic report.

### Why PostgreSQL as the queue?

Supabase PostgreSQL is already the system of record. A row-locking lease queue
keeps the MVP operationally small while still providing concurrency control,
heartbeat, retry, and crash recovery. The design avoids adding Redis or a
managed broker before scale justifies it.

### How is uncertainty handled?

Bad alignment fails visibly. Regions carry confidence and metrics. OCR can be
absent without inventing text. The ONNX model is used only above its confidence
gate and otherwise reports the deterministic rules provider. The synthetic
classifier benchmark is explicitly not presented as real-world accuracy.

### Why one EC2 instance?

The portfolio workload needs demonstrable container deployment, not a
production-scale platform. One `t3.small`, one worker, concurrency one, private
service networking inside Compose, and no NAT Gateway or load balancer keep the
runtime inside a USD 25 target while preserving a real cloud path.

### What failed during deployment?

Amazon Linux package conflicts, named-volume ownership, a self-public-IP
health probe, IP TLS clients without DNS SNI, and swap inspection syntax all
failed in distinct ways. During v0.2, CloudFormation restarted the existing
instance without rerunning updated user data, leaving the old Compose bundle
and then a stale IP certificate. The deployment now runs an explicit,
commit-pinned SSM refresh after every stack update and rotates TLS when the
public IP changes. Each failure was verified at the underlying layer without
adding capacity.

## Measured evidence

- Unit/service suites: 66 agent, 56 API, 32 vision, 15 web, and 8 contract
  tests, plus separately passing real Supabase RAG and AWS provider tests.
- Frozen agent evaluation: 30/30 curated cases passed; routing, evidence,
  citation, conflict, and refusal gates were 100%; unsupported claims,
  cross-project disclosures, and injection overrides were zero.
- Deployed drawing journey: authenticated upload through deterministic
  CV/OCR/ONNX evidence and printable report, followed by cleanup.
- Deployed RAG journey: technical-note ingestion, local BGE embedding,
  pgvector hybrid retrieval, Bedrock answer, verified citation, review-only
  RFI, and cleanup.
- ONNX synthetic benchmark: 1.000 accuracy and macro-F1 versus 0.750 accuracy
  and 0.667 macro-F1 for deterministic rules; 0.1697 ms CPU p95 for one crop on
  the recorded development machine.
- Verified AWS billing snapshot: Budget actual USD 0.589; forecast unavailable
  for insufficient history; alerts remain at USD 10, 15, 20, and 25.

## Limitations

- PlanDelta supports revision review; it does not certify quantities, price,
  code compliance, constructability, or approval.
- Results depend on drawing quality and alignment. Multi-page batch analysis
  and cross-sheet reasoning are outside the MVP.
- The classifier dataset is synthetic and cannot establish field accuracy.
- The public IPv4 TLS certificate is short-lived and tied to the current
  instance address; replacing or stop/starting the instance changes the URL.
- Live processing depends on the temporary single-instance AWS runtime. The
  labelled sample remains available if that compute is intentionally torn
  down.
