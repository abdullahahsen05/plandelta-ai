# Database and RAG Contract v0.2

Names may be adapted to existing Prisma conventions, but the semantics and
constraints below are required.

## Required entities

### KnowledgeDocument

- `id`, `projectId`, `ownerId`
- original filename, detected MIME, storage provider/key
- document type
- lifecycle status: uploaded, extracting, embedding, ready, failed, deleted
- active version ID
- created/updated/deleted timestamps

### KnowledgeDocumentVersion

- `id`, `documentId`, `projectId`
- revision label, effective date, optional supersedes ID
- SHA-256 checksum
- page count, extracted character count
- parser name/version, OCR provider/version
- status and safe failure code
- `isActive`

### KnowledgeChunk

- `id`, `documentVersionId`, `documentId`, `projectId`
- stable ordinal and stable content hash
- page number, section path/title, character offsets
- sanitized text excerpt and full chunk text stored as private project data
- PostgreSQL `tsvector`
- vector embedding with fixed dimension
- embedding provider/model/version
- chunker version
- `isActive`, created timestamp

### IngestionJob

- durable state, attempt, lease, heartbeat, progress, failure fields, and
  idempotency key following the existing analysis job pattern

### Conversation

- `id`, `projectId`, optional `analysisId`, `ownerId`, title, created/updated
- conversations are always project scoped; analysis scope may be narrower

### Message

- `id`, `conversationId`, role, safe rendered content, message type
- user id for user messages
- provider/model/prompt version for assistant messages
- token usage and bounded estimated cost
- status and created timestamp
- no hidden reasoning field

### AgentRun

- `id`, `conversationId`, `userMessageId`, optional `assistantMessageId`
- project/analysis/profile snapshot
- state, attempt, lease/heartbeat, cancellation, deadlines
- selected specialists and structured reason codes
- turn/tool/chunk counts, token use, estimated cost
- verifier outcome, failure code, timestamps

### AgentStep

- `id`, `agentRunId`, ordered sequence
- node/agent/tool name and version
- event type, status, safe summary, structured reason code
- timing, token counts, estimated cost, safe error code
- never store complete prompts, chain-of-thought, signed URLs, OCR content, or
  full private chunks in trace fields

### Citation

- `id`, `messageId`, `agentRunId`, display order, citation type
- exactly one target shape:
  - detected change and optional artifact/normalized region; or
  - knowledge document/version/chunk/page/section
- quoted excerpt kept short and authorized
- retrieval/verification metadata
- project ID copied for efficient constraint/RLS checks

## Analysis profile

Add a backward-compatible profile identifier to project and analysis records.
Existing rows resolve to `construction_drawing`. Persist the profile version
used by each analysis and agent run.

## Hybrid search

Implement one database function or repository query that:

1. receives server-derived project ID and optional document filters;
2. searches only active, ready document versions;
3. obtains full-text rank and vector distance;
4. normalizes and combines scores with configured weights;
5. applies a bounded candidate and final result limit;
6. returns page/section/source metadata required for citations;
7. does not accept arbitrary SQL fragments or user-defined ordering;
8. produces stable ordering for equal scores.

Do not rely on vector similarity alone. Exact specification numbers, room
labels, component IDs, and drawing notes need lexical retrieval.

## Conflict handling

A conflicting record can be:

- two active documents with the same section/key and materially different
  values;
- an older revision retrieved alongside a newer active revision;
- two sources with equal authority and incompatible instructions;
- duplicate-looking records whose metadata cannot establish precedence.

The retrieval layer returns both candidates with conflict metadata. The agent
must state the disagreement and cite both. It may mention a clearly configured
revision/effective-date precedence rule but may not hide the losing record.

## Re-ingestion and stale data

- Same checksum and parser/chunker/embedding versions: idempotently reuse.
- Same document with a new version: insert new version/chunks transactionally,
  then deactivate the replaced version.
- Changed chunker/embedding model: create a new indexed version or re-index
  deterministically; never mix vector dimensions.
- Failed extraction/embedding: keep safe job/error metadata and do not mark the
  document searchable.
- Deletion: remove or deactivate chunks and delete private artifacts according
  to the existing retention policy.

## RLS and invariants

- Users may read/write only documents, conversations, and messages belonging
  to projects they own.
- Browser roles cannot write agent steps, assistant messages, embeddings, or
  verified citations directly.
- A citation target must share the same project as its message/run.
- A conversation analysis, when present, must belong to its project.
- Service role access remains server-side.
- Add indexes for ownership filters, states, leases, active document versions,
  full-text search, and vector search.

## Migration verification

Final verification must cover:

- complete migration chain on a clean database;
- upgrade from a representative v0.1.0 schema/data snapshot;
- rollback strategy or documented forward-only recovery;
- RLS cross-user denials;
- hybrid ranking and stable ordering;
- duplicate ingestion idempotency;
- version replacement/stale exclusion;
- citation cross-project constraint;
- concurrent job leasing.
