# Database Design

Supabase PostgreSQL is the system of record. Prisma owns ordinary schema
migrations. Versioned SQL owns RLS, triggers, extensions, and queue claim
functions where Prisma is insufficient.

## Conventions

- UUID primary keys.
- timestamptz for all timestamps.
- snake_case database columns and clear mapped model names.
- created_at and updated_at on mutable entities.
- Soft deletion only where restoration has clear product value.
- Coordinates are normalized floats from 0 to 1.
- JSONB is reserved for variable evidence, metrics, and polygons, not core
  relational fields.

## Tables

### profiles

- id: uuid, primary key and foreign key to auth.users.id
- display_name: text
- avatar_url: text nullable
- created_at, updated_at

### projects

- id: uuid primary key
- owner_id: uuid foreign key to profiles.id
- name: text
- project_code: text nullable
- description: text nullable
- status: ACTIVE or ARCHIVED
- created_at, updated_at

Indexes: owner_id plus updated_at descending.

### plan_revisions

- id: uuid primary key
- project_id: uuid foreign key
- label: text
- revision_code: text nullable
- role: BASELINE or CANDIDATE
- original_filename: text
- mime_type: text
- byte_size: bigint
- checksum_sha256: text
- storage_provider: LOCAL or S3
- storage_key: text
- page_count: integer
- selected_page: integer nullable
- width_px, height_px: integer nullable
- upload_status: PENDING, READY, FAILED
- metadata: jsonb
- created_at, updated_at

Constraints: positive sizes/pages; storage key unique within provider.
Indexes: project_id plus created_at.

### analyses

- id: uuid primary key
- project_id: uuid foreign key
- baseline_revision_id: uuid foreign key
- candidate_revision_id: uuid foreign key
- requested_by: uuid foreign key to profiles.id
- status: job state enum
- progress: integer from 0 to 100
- current_stage: text
- priority: smallint default 0
- attempt_count: integer default 0
- max_attempts: integer default 3
- lease_owner: text nullable
- lease_expires_at: timestamptz nullable
- heartbeat_at: timestamptz nullable
- next_attempt_at: timestamptz nullable
- started_at, completed_at: timestamptz nullable
- error_code, error_message: text nullable
- schema_version, engine_version: text
- configuration: jsonb
- metrics: jsonb
- warnings: jsonb
- summary_provider: DETERMINISTIC or BEDROCK
- created_at, updated_at

Constraints: baseline differs from candidate; both belong to project; progress
range; attempts nonnegative.

Queue index: status, next_attempt_at, priority descending, created_at.
Lease index: status, lease_expires_at.

### analysis_artifacts

- id: uuid primary key
- analysis_id: uuid foreign key
- kind: BASELINE_RENDER, CANDIDATE_RENDER, ALIGNED_CANDIDATE, OVERLAY,
  ADDED_MASK, REMOVED_MASK, EVIDENCE_CROP, REPORT
- storage_provider: LOCAL or S3
- storage_key: text
- mime_type: text
- width_px, height_px, byte_size: integer/bigint nullable
- checksum_sha256: text nullable
- metadata: jsonb
- created_at

Unique: analysis_id, kind, storage_key.

### detected_changes

- id: uuid primary key
- analysis_id: uuid foreign key
- sequence: integer
- change_type: ADDED, REMOVED, MODIFIED, TEXT_CHANGED
- category: WALL_LINEWORK, DOOR, WINDOW, FIXTURE_SYMBOL, DIMENSION, TEXT_NOTE,
  ROOM_LABEL, UNKNOWN
- source: RULES, ONNX, OCR, HYBRID
- x, y, width, height: real normalized coordinates
- polygon: jsonb nullable
- confidence: real from 0 to 1
- old_text, new_text: text nullable
- text_confidence: real nullable
- affected_trades: text array
- quantity_delta: numeric nullable
- unit: text nullable
- impact: text nullable
- evidence: jsonb
- created_at

Unique: analysis_id plus sequence.
Indexes: analysis_id, change_type, category.

### analysis_reports

- id: uuid primary key
- analysis_id: uuid unique foreign key
- executive_summary: text
- structured_summary: jsonb
- provider: DETERMINISTIC or BEDROCK
- model_id: text nullable
- prompt_version: text nullable
- generated_at
- updated_at

### audit_events

- id: uuid primary key
- actor_id: uuid nullable
- project_id: uuid nullable
- analysis_id: uuid nullable
- event_type: text
- correlation_id: text
- metadata: jsonb with secrets and signed URLs forbidden
- created_at

Index: project_id plus created_at; analysis_id plus created_at.

## Row-level security

- Users may select and modify only projects they own.
- Revision, analysis, artifact, change, and report access derives from project
  ownership.
- Browser clients never access queue lease fields directly.
- Service-role operations remain server-side.
- Every RLS policy requires a negative cross-user integration test.

## Queue claim behavior

Create a database function or equivalent transaction that:

1. Selects one eligible QUEUED or RETRYING analysis using FOR UPDATE SKIP
   LOCKED.
2. Requires next_attempt_at to be null or in the past.
3. Sets status CLAIMED, lease owner, lease expiry, heartbeat, started_at, and
   increments attempt count.
4. Returns the claimed row.

Create stale-lease recovery that requeues an expired claim when attempts remain
or marks it FAILED when the limit is exhausted.

## Migration rules

- Never edit a migration that has reached a shared environment.
- Test the complete migration chain from empty database.
- Seed scripts are idempotent and contain no production credentials.
- Destructive migrations require an explicit documented data strategy.
- Prisma direct migration URL and pooled runtime URL are separate environment
  variables when Supabase requires it.
