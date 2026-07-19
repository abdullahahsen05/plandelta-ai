CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

CREATE TYPE "AnalysisProfile" AS ENUM ('construction_drawing', 'engineering_schematic');
CREATE TYPE "KnowledgeDocumentType" AS ENUM (
  'specification', 'drawing_notes', 'revision_narrative', 'addendum',
  'boq_schedule', 'rfi', 'prior_report', 'technical_note'
);
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM (
  'uploaded', 'extracting', 'embedding', 'ready', 'failed', 'deleted'
);
CREATE TYPE "KnowledgeVersionStatus" AS ENUM (
  'pending', 'extracting', 'embedding', 'ready', 'failed'
);
CREATE TYPE "IngestionJobStatus" AS ENUM (
  'queued', 'claimed', 'extracting', 'chunking', 'embedding',
  'retrying', 'completed', 'failed', 'cancelled'
);
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'archived');
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');
CREATE TYPE "MessageType" AS ENUM ('question', 'answer', 'rfi_draft', 'system_notice');
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE "AgentRunStatus" AS ENUM (
  'queued', 'running', 'verifying', 'completed', 'failed', 'cancelled', 'expired'
);
CREATE TYPE "AgentStepStatus" AS ENUM ('started', 'completed', 'failed', 'blocked');
CREATE TYPE "CitationType" AS ENUM ('visual_change', 'document_chunk');

ALTER TABLE "projects"
  ADD COLUMN "analysis_profile" "AnalysisProfile" NOT NULL DEFAULT 'construction_drawing',
  ADD COLUMN "profile_version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "analyses"
  ADD COLUMN "analysis_profile" "AnalysisProfile" NOT NULL DEFAULT 'construction_drawing',
  ADD COLUMN "profile_version" TEXT NOT NULL DEFAULT '1.0';

CREATE TABLE "knowledge_documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "original_filename" TEXT NOT NULL,
  "detected_mime_type" TEXT NOT NULL,
  "byte_size" BIGINT NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "storage_provider" "StorageProvider" NOT NULL,
  "storage_key" TEXT NOT NULL,
  "document_type" "KnowledgeDocumentType" NOT NULL,
  "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'uploaded',
  "active_version_id" UUID,
  "failure_code" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "knowledge_documents_byte_size_positive" CHECK ("byte_size" > 0),
  CONSTRAINT "knowledge_documents_checksum_valid" CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "knowledge_documents_filename_not_blank" CHECK (length(btrim("original_filename")) BETWEEN 1 AND 255),
  CONSTRAINT "knowledge_documents_mime_supported" CHECK ("detected_mime_type" IN ('application/pdf', 'text/plain'))
);

CREATE TABLE "knowledge_document_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "supersedes_id" UUID,
  "revision_label" TEXT,
  "effective_date" DATE,
  "checksum_sha256" TEXT NOT NULL,
  "page_count" INTEGER,
  "extracted_character_count" INTEGER NOT NULL DEFAULT 0,
  "parser_name" TEXT NOT NULL,
  "parser_version" TEXT NOT NULL,
  "ocr_provider" TEXT,
  "ocr_version" TEXT,
  "chunker_version" TEXT NOT NULL,
  "embedding_provider" TEXT NOT NULL,
  "embedding_model" TEXT NOT NULL,
  "embedding_dimension" INTEGER NOT NULL,
  "status" "KnowledgeVersionStatus" NOT NULL DEFAULT 'pending',
  "failure_code" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "knowledge_versions_checksum_valid" CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "knowledge_versions_counts_valid" CHECK (
    ("page_count" IS NULL OR "page_count" > 0)
    AND "extracted_character_count" >= 0
    AND "embedding_dimension" = 384
  )
);

CREATE TABLE "knowledge_chunks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_version_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "content_hash" TEXT NOT NULL,
  "page_number" INTEGER NOT NULL,
  "section_path" TEXT,
  "section_title" TEXT,
  "character_start" INTEGER NOT NULL,
  "character_end" INTEGER NOT NULL,
  "excerpt" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "search_vector" TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("section_title", '')), 'A')
    || setweight(to_tsvector('english', "content"), 'B')
  ) STORED,
  "embedding" "extensions"."vector"(384),
  "embedding_provider" TEXT NOT NULL,
  "embedding_model" TEXT NOT NULL,
  "embedding_version" TEXT NOT NULL,
  "chunker_version" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "conflict_key" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_chunks_ordinal_positive" CHECK ("ordinal" > 0),
  CONSTRAINT "knowledge_chunks_page_positive" CHECK ("page_number" > 0),
  CONSTRAINT "knowledge_chunks_offsets_valid" CHECK (
    "character_start" >= 0 AND "character_end" > "character_start"
  ),
  CONSTRAINT "knowledge_chunks_hash_valid" CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "knowledge_chunks_content_bounded" CHECK (
    length("content") BETWEEN 1 AND 8000 AND length("excerpt") BETWEEN 1 AND 1200
  )
);

CREATE TABLE "ingestion_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "document_version_id" UUID,
  "project_id" UUID NOT NULL,
  "status" "IngestionJobStatus" NOT NULL DEFAULT 'queued',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "current_stage" TEXT NOT NULL DEFAULT 'queued',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "lease_owner" TEXT,
  "lease_expires_at" TIMESTAMPTZ(6),
  "heartbeat_at" TIMESTAMPTZ(6),
  "next_attempt_at" TIMESTAMPTZ(6),
  "idempotency_key" UUID NOT NULL,
  "failure_code" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "ingestion_jobs_progress_range" CHECK ("progress" BETWEEN 0 AND 100),
  CONSTRAINT "ingestion_jobs_attempts_valid" CHECK (
    "attempt_count" >= 0 AND "max_attempts" > 0 AND "attempt_count" <= "max_attempts"
  ),
  CONSTRAINT "ingestion_jobs_lease_coherent" CHECK (
    ("lease_owner" IS NULL AND "lease_expires_at" IS NULL)
    OR ("lease_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
  )
);

CREATE TABLE "conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "analysis_id" UUID,
  "owner_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_title_not_blank" CHECK (length(btrim("title")) BETWEEN 1 AND 160)
);

CREATE TABLE "messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "author_id" UUID,
  "role" "MessageRole" NOT NULL,
  "message_type" "MessageType" NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'pending',
  "content" TEXT NOT NULL,
  "idempotency_key" UUID,
  "provider" TEXT,
  "model_id" TEXT,
  "prompt_version" TEXT,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_content_bounded" CHECK (length("content") BETWEEN 1 AND 12000),
  CONSTRAINT "messages_token_cost_nonnegative" CHECK (
    "input_tokens" >= 0 AND "output_tokens" >= 0 AND "estimated_cost_usd" >= 0
  ),
  CONSTRAINT "messages_author_role_valid" CHECK (
    ("role" = 'user' AND "author_id" IS NOT NULL)
    OR ("role" <> 'user' AND "author_id" IS NULL)
  )
);

CREATE TABLE "agent_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "user_message_id" UUID NOT NULL,
  "assistant_message_id" UUID,
  "project_id" UUID NOT NULL,
  "analysis_id" UUID,
  "analysis_profile" "AnalysisProfile" NOT NULL,
  "profile_version" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'queued',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "lease_owner" TEXT,
  "lease_expires_at" TIMESTAMPTZ(6),
  "heartbeat_at" TIMESTAMPTZ(6),
  "deadline_at" TIMESTAMPTZ(6) NOT NULL,
  "cancellation_requested" BOOLEAN NOT NULL DEFAULT false,
  "selected_specialists" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "route_reason_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "model_turn_count" INTEGER NOT NULL DEFAULT 0,
  "tool_call_count" INTEGER NOT NULL DEFAULT 0,
  "retrieved_chunk_count" INTEGER NOT NULL DEFAULT 0,
  "repair_count" INTEGER NOT NULL DEFAULT 0,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
  "verifier_outcome" TEXT,
  "failure_code" TEXT,
  "correlation_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_runs_counts_bounded" CHECK (
    "attempt_count" >= 0 AND "max_attempts" BETWEEN 1 AND 3
    AND "attempt_count" <= "max_attempts"
    AND "model_turn_count" BETWEEN 0 AND 8
    AND "tool_call_count" BETWEEN 0 AND 12
    AND "retrieved_chunk_count" BETWEEN 0 AND 12
    AND "repair_count" BETWEEN 0 AND 1
    AND "input_tokens" >= 0 AND "output_tokens" >= 0
    AND "estimated_cost_usd" BETWEEN 0 AND 0.02
  ),
  CONSTRAINT "agent_runs_lease_coherent" CHECK (
    ("lease_owner" IS NULL AND "lease_expires_at" IS NULL)
    OR ("lease_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
  )
);

CREATE TABLE "agent_steps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_run_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "node_name" TEXT NOT NULL,
  "node_version" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "status" "AgentStepStatus" NOT NULL,
  "safe_summary" TEXT,
  "reason_code" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "duration_ms" INTEGER,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_steps_sequence_positive" CHECK ("sequence" > 0),
  CONSTRAINT "agent_steps_safe_summary_bounded" CHECK (
    "safe_summary" IS NULL OR length("safe_summary") <= 500
  ),
  CONSTRAINT "agent_steps_metrics_nonnegative" CHECK (
    ("duration_ms" IS NULL OR "duration_ms" >= 0)
    AND "input_tokens" >= 0 AND "output_tokens" >= 0 AND "estimated_cost_usd" >= 0
  )
);

CREATE TABLE "citations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "agent_run_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "display_order" INTEGER NOT NULL,
  "citation_type" "CitationType" NOT NULL,
  "label" TEXT NOT NULL,
  "supports_claim_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "detected_change_id" UUID,
  "artifact_id" UUID,
  "analysis_id" UUID,
  "normalized_region" JSONB,
  "knowledge_document_id" UUID,
  "knowledge_version_id" UUID,
  "knowledge_chunk_id" UUID,
  "page_number" INTEGER,
  "section_title" TEXT,
  "excerpt" TEXT,
  "retrieval_metadata" JSONB NOT NULL DEFAULT '{}',
  "verified_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "citations_order_positive" CHECK ("display_order" > 0),
  CONSTRAINT "citations_excerpt_bounded" CHECK ("excerpt" IS NULL OR length("excerpt") <= 1200),
  CONSTRAINT "citations_exact_target_shape" CHECK (
    (
      "citation_type" = 'visual_change'
      AND "analysis_id" IS NOT NULL AND "detected_change_id" IS NOT NULL
      AND "knowledge_document_id" IS NULL AND "knowledge_version_id" IS NULL
      AND "knowledge_chunk_id" IS NULL AND "page_number" IS NULL
    )
    OR
    (
      "citation_type" = 'document_chunk'
      AND "analysis_id" IS NULL AND "detected_change_id" IS NULL AND "artifact_id" IS NULL
      AND "knowledge_document_id" IS NOT NULL AND "knowledge_version_id" IS NOT NULL
      AND "knowledge_chunk_id" IS NOT NULL AND "page_number" > 0 AND "excerpt" IS NOT NULL
    )
  )
);

ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "knowledge_documents_owner_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
ALTER TABLE "knowledge_document_versions"
  ADD CONSTRAINT "knowledge_versions_document_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "knowledge_versions_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "knowledge_versions_supersedes_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "knowledge_document_versions"("id") ON DELETE SET NULL;
ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_active_version_fkey" FOREIGN KEY ("active_version_id") REFERENCES "knowledge_document_versions"("id") ON DELETE SET NULL;
ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_version_fkey" FOREIGN KEY ("document_version_id") REFERENCES "knowledge_document_versions"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "knowledge_chunks_document_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "knowledge_chunks_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
ALTER TABLE "ingestion_jobs"
  ADD CONSTRAINT "ingestion_jobs_document_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "ingestion_jobs_version_fkey" FOREIGN KEY ("document_version_id") REFERENCES "knowledge_document_versions"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "ingestion_jobs_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "conversations_analysis_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "conversations_owner_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_conversation_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "messages_author_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_conversation_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "agent_runs_user_message_fkey" FOREIGN KEY ("user_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "agent_runs_assistant_message_fkey" FOREIGN KEY ("assistant_message_id") REFERENCES "messages"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "agent_runs_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "agent_runs_analysis_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE;
ALTER TABLE "agent_steps"
  ADD CONSTRAINT "agent_steps_run_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE;
ALTER TABLE "citations"
  ADD CONSTRAINT "citations_message_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "citations_run_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "citations_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "citations_analysis_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "citations_change_fkey" FOREIGN KEY ("detected_change_id") REFERENCES "detected_changes"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "citations_artifact_fkey" FOREIGN KEY ("artifact_id") REFERENCES "analysis_artifacts"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "citations_document_fkey" FOREIGN KEY ("knowledge_document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "citations_version_fkey" FOREIGN KEY ("knowledge_version_id") REFERENCES "knowledge_document_versions"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "citations_chunk_fkey" FOREIGN KEY ("knowledge_chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "knowledge_documents_storage_key_unique" ON "knowledge_documents"("storage_provider", "storage_key");
CREATE UNIQUE INDEX "knowledge_documents_active_version_key" ON "knowledge_documents"("active_version_id");
CREATE INDEX "knowledge_documents_project_status_idx" ON "knowledge_documents"("project_id", "status", "updated_at" DESC);
CREATE INDEX "knowledge_documents_owner_updated_idx" ON "knowledge_documents"("owner_id", "updated_at" DESC);
CREATE UNIQUE INDEX "knowledge_versions_ingestion_identity_unique" ON "knowledge_document_versions"(
  "document_id", "checksum_sha256", "parser_version", "chunker_version", "embedding_model"
);
CREATE UNIQUE INDEX "knowledge_versions_one_active_per_document" ON "knowledge_document_versions"("document_id") WHERE "is_active";
CREATE INDEX "knowledge_versions_project_active_idx" ON "knowledge_document_versions"("project_id", "is_active", "status", "effective_date" DESC);
CREATE INDEX "knowledge_versions_document_created_idx" ON "knowledge_document_versions"("document_id", "created_at" DESC);
CREATE UNIQUE INDEX "knowledge_chunks_version_ordinal_unique" ON "knowledge_chunks"("document_version_id", "ordinal");
CREATE UNIQUE INDEX "knowledge_chunks_version_hash_unique" ON "knowledge_chunks"("document_version_id", "content_hash");
CREATE INDEX "knowledge_chunks_project_active_idx" ON "knowledge_chunks"("project_id", "is_active", "document_version_id");
CREATE INDEX "knowledge_chunks_document_created_idx" ON "knowledge_chunks"("document_id", "created_at");
CREATE INDEX "knowledge_chunks_search_vector_idx" ON "knowledge_chunks" USING GIN ("search_vector");
CREATE INDEX "knowledge_chunks_conflict_key_idx" ON "knowledge_chunks"("project_id", "conflict_key") WHERE "conflict_key" IS NOT NULL;
CREATE UNIQUE INDEX "ingestion_jobs_document_idempotency_unique" ON "ingestion_jobs"("document_id", "idempotency_key");
CREATE INDEX "ingestion_jobs_queue_idx" ON "ingestion_jobs"("status", "next_attempt_at", "created_at");
CREATE INDEX "ingestion_jobs_lease_idx" ON "ingestion_jobs"("status", "lease_expires_at");
CREATE INDEX "ingestion_jobs_project_created_idx" ON "ingestion_jobs"("project_id", "created_at" DESC);
CREATE INDEX "conversations_project_updated_idx" ON "conversations"("project_id", "updated_at" DESC);
CREATE INDEX "conversations_owner_updated_idx" ON "conversations"("owner_id", "updated_at" DESC);
CREATE UNIQUE INDEX "messages_conversation_idempotency_unique" ON "messages"("conversation_id", "idempotency_key");
CREATE INDEX "messages_conversation_created_idx" ON "messages"("conversation_id", "created_at");
CREATE UNIQUE INDEX "agent_runs_assistant_message_key" ON "agent_runs"("assistant_message_id");
CREATE INDEX "agent_runs_queue_idx" ON "agent_runs"("status", "created_at");
CREATE INDEX "agent_runs_lease_idx" ON "agent_runs"("status", "lease_expires_at");
CREATE INDEX "agent_runs_project_created_idx" ON "agent_runs"("project_id", "created_at" DESC);
CREATE INDEX "agent_runs_conversation_created_idx" ON "agent_runs"("conversation_id", "created_at");
CREATE UNIQUE INDEX "agent_steps_run_sequence_unique" ON "agent_steps"("agent_run_id", "sequence");
CREATE INDEX "agent_steps_run_created_idx" ON "agent_steps"("agent_run_id", "created_at");
CREATE UNIQUE INDEX "citations_message_order_unique" ON "citations"("message_id", "display_order");
CREATE INDEX "citations_project_created_idx" ON "citations"("project_id", "created_at");
CREATE INDEX "citations_run_order_idx" ON "citations"("agent_run_id", "display_order");

CREATE TRIGGER "knowledge_documents_set_updated_at" BEFORE UPDATE ON "knowledge_documents"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "ingestion_jobs_set_updated_at" BEFORE UPDATE ON "ingestion_jobs"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "conversations_set_updated_at" BEFORE UPDATE ON "conversations"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "messages_set_updated_at" BEFORE UPDATE ON "messages"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "agent_runs_set_updated_at" BEFORE UPDATE ON "agent_runs"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE FUNCTION "public"."validate_agentic_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'knowledge_document_versions' AND NOT EXISTS (
    SELECT 1 FROM "public"."knowledge_documents" d
    WHERE d.id = NEW.document_id AND d.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Document version scope mismatch.' USING ERRCODE = '23514';
  ELSIF TG_TABLE_NAME = 'knowledge_chunks' AND NOT EXISTS (
    SELECT 1
    FROM "public"."knowledge_document_versions" v
    JOIN "public"."knowledge_documents" d ON d.id = v.document_id
    WHERE v.id = NEW.document_version_id AND v.document_id = NEW.document_id
      AND v.project_id = NEW.project_id AND d.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Knowledge chunk scope mismatch.' USING ERRCODE = '23514';
  ELSIF TG_TABLE_NAME = 'conversations' AND NEW.analysis_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "public"."analyses" a
    WHERE a.id = NEW.analysis_id AND a.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Conversation analysis scope mismatch.' USING ERRCODE = '23514';
  ELSIF TG_TABLE_NAME = 'agent_runs' AND NOT EXISTS (
    SELECT 1
    FROM "public"."conversations" c
    JOIN "public"."messages" m ON m.id = NEW.user_message_id
    WHERE c.id = NEW.conversation_id AND c.project_id = NEW.project_id
      AND m.conversation_id = c.id AND m.role = 'user'
      AND (NEW.analysis_id IS NULL OR c.analysis_id = NEW.analysis_id)
  ) THEN
    RAISE EXCEPTION 'Agent run scope mismatch.' USING ERRCODE = '23514';
  ELSIF TG_TABLE_NAME = 'citations' AND NOT EXISTS (
    SELECT 1
    FROM "public"."agent_runs" r
    JOIN "public"."messages" m ON m.id = NEW.message_id
    WHERE r.id = NEW.agent_run_id AND r.project_id = NEW.project_id
      AND m.conversation_id = r.conversation_id AND m.role = 'assistant'
  ) THEN
    RAISE EXCEPTION 'Citation message/run scope mismatch.' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'citations' AND NEW.citation_type = 'visual_change' AND NOT EXISTS (
    SELECT 1
    FROM "public"."detected_changes" c
    JOIN "public"."analyses" a ON a.id = c.analysis_id
    WHERE c.id = NEW.detected_change_id AND a.id = NEW.analysis_id
      AND a.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Visual citation scope mismatch.' USING ERRCODE = '23514';
  ELSIF TG_TABLE_NAME = 'citations' AND NEW.citation_type = 'document_chunk' AND NOT EXISTS (
    SELECT 1
    FROM "public"."knowledge_chunks" c
    JOIN "public"."knowledge_document_versions" v ON v.id = c.document_version_id
    WHERE c.id = NEW.knowledge_chunk_id AND c.document_id = NEW.knowledge_document_id
      AND c.project_id = NEW.project_id AND v.id = NEW.knowledge_version_id
      AND (v.is_active OR coalesce((NEW.retrieval_metadata ->> 'conflictingOlderRevision')::boolean, false))
  ) THEN
    RAISE EXCEPTION 'Document citation scope mismatch.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "knowledge_versions_validate_scope"
BEFORE INSERT OR UPDATE ON "knowledge_document_versions"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_agentic_scope"();
CREATE TRIGGER "knowledge_chunks_validate_scope"
BEFORE INSERT OR UPDATE ON "knowledge_chunks"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_agentic_scope"();
CREATE TRIGGER "conversations_validate_scope"
BEFORE INSERT OR UPDATE ON "conversations"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_agentic_scope"();
CREATE TRIGGER "agent_runs_validate_scope"
BEFORE INSERT OR UPDATE ON "agent_runs"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_agentic_scope"();
CREATE TRIGGER "citations_validate_scope"
BEFORE INSERT OR UPDATE ON "citations"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_agentic_scope"();

CREATE OR REPLACE FUNCTION "public"."hybrid_search_knowledge"(
  p_project_id UUID,
  p_query_text TEXT,
  p_query_embedding "extensions"."vector"(384),
  p_limit INTEGER DEFAULT 12,
  p_document_types TEXT[] DEFAULT NULL,
  p_effective_at DATE DEFAULT NULL,
  p_text_weight REAL DEFAULT 0.45,
  p_vector_weight REAL DEFAULT 0.55
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  document_version_id UUID,
  page_number INTEGER,
  section_title TEXT,
  excerpt TEXT,
  revision_label TEXT,
  effective_date DATE,
  checksum_sha256 TEXT,
  text_score REAL,
  vector_score REAL,
  combined_score REAL,
  conflict_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 24 THEN
    RAISE EXCEPTION 'Result limit must be between 1 and 24.' USING ERRCODE = '22023';
  END IF;
  IF p_query_embedding IS NULL OR length(btrim(p_query_text)) = 0 THEN
    RAISE EXCEPTION 'Text and embedding queries are required.' USING ERRCODE = '22023';
  END IF;
  IF p_text_weight < 0 OR p_vector_weight < 0
     OR abs((p_text_weight + p_vector_weight) - 1.0) > 0.001 THEN
    RAISE EXCEPTION 'Hybrid weights must be non-negative and total 1.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH scored AS (
    SELECT
      c.id,
      c.document_id,
      c.document_version_id,
      c.page_number,
      c.section_title,
      c.excerpt,
      v.revision_label,
      v.effective_date,
      v.checksum_sha256,
      least(1.0, ts_rank_cd(c.search_vector, websearch_to_tsquery('english', left(p_query_text, 1000))) * 4)::REAL AS lexical,
      greatest(0.0, least(1.0, 1 - (c.embedding <=> p_query_embedding)))::REAL AS semantic,
      count(*) OVER (
        PARTITION BY c.project_id, coalesce(c.conflict_key, c.id::TEXT)
      )::INTEGER AS conflicts
    FROM "public"."knowledge_chunks" c
    JOIN "public"."knowledge_document_versions" v ON v.id = c.document_version_id
    JOIN "public"."knowledge_documents" d ON d.id = c.document_id
    WHERE c.project_id = p_project_id
      AND c.is_active AND c.embedding IS NOT NULL
      AND v.is_active AND v.status = 'ready'
      AND d.status = 'ready' AND d.deleted_at IS NULL
      AND (p_document_types IS NULL OR d.document_type::TEXT = ANY(p_document_types))
      AND (p_effective_at IS NULL OR v.effective_date IS NULL OR v.effective_date <= p_effective_at)
      AND (
        c.search_vector @@ websearch_to_tsquery('english', left(p_query_text, 1000))
        OR 1 - (c.embedding <=> p_query_embedding) >= 0.2
      )
  )
  SELECT
    s.id, s.document_id, s.document_version_id, s.page_number, s.section_title, s.excerpt,
    s.revision_label, s.effective_date, s.checksum_sha256, s.lexical, s.semantic,
    (s.lexical * p_text_weight + s.semantic * p_vector_weight)::REAL,
    s.conflicts
  FROM scored s
  ORDER BY
    (s.lexical * p_text_weight + s.semantic * p_vector_weight) DESC,
    s.effective_date DESC NULLS LAST,
    s.id
  LIMIT p_limit;
END;
$$;

ALTER TABLE "knowledge_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingestion_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "citations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents_select_owned" ON "knowledge_documents" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "knowledge_versions_select_owned" ON "knowledge_document_versions" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "ingestion_jobs_select_owned" ON "ingestion_jobs" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "conversations_select_owned" ON "conversations" FOR SELECT TO authenticated
USING (owner_id = auth.uid());
CREATE POLICY "messages_select_owned" ON "messages" FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM "conversations" c WHERE c.id = conversation_id AND c.owner_id = auth.uid()
));
CREATE POLICY "agent_runs_select_owned" ON "agent_runs" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "agent_steps_select_owned" ON "agent_steps" FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM "agent_runs" r
  JOIN "projects" p ON p.id = r.project_id
  WHERE r.id = agent_run_id AND p.owner_id = auth.uid()
));
CREATE POLICY "citations_select_owned" ON "citations" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));

REVOKE ALL ON TABLE
  "knowledge_documents", "knowledge_document_versions", "knowledge_chunks", "ingestion_jobs",
  "conversations", "messages", "agent_runs", "agent_steps", "citations"
FROM anon, authenticated;
GRANT SELECT ON TABLE
  "knowledge_documents", "knowledge_document_versions", "ingestion_jobs",
  "conversations", "messages", "agent_runs", "agent_steps", "citations"
TO authenticated;
REVOKE ALL ON FUNCTION "public"."hybrid_search_knowledge"(
  UUID, TEXT, "extensions"."vector", INTEGER, TEXT[], DATE, REAL, REAL
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."hybrid_search_knowledge"(
  UUID, TEXT, "extensions"."vector", INTEGER, TEXT[], DATE, REAL, REAL
) TO service_role, postgres;

COMMENT ON TABLE "agent_steps" IS
  'Redacted structured execution events only; prompts, chain-of-thought, document bodies, and signed URLs are prohibited.';
COMMENT ON FUNCTION "public"."hybrid_search_knowledge"(
  UUID, TEXT, "extensions"."vector", INTEGER, TEXT[], DATE, REAL, REAL
) IS 'Project-scoped active-version hybrid retrieval. Server-side only.';
