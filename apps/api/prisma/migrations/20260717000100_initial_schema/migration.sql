CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "RevisionRole" AS ENUM ('BASELINE', 'CANDIDATE');
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3');
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
CREATE TYPE "AnalysisStatus" AS ENUM (
  'QUEUED',
  'CLAIMED',
  'PREPROCESSING',
  'ALIGNING',
  'DIFFING',
  'OCR',
  'CLASSIFYING',
  'SUMMARIZING',
  'RETRYING',
  'COMPLETED',
  'FAILED'
);
CREATE TYPE "SummaryProvider" AS ENUM ('DETERMINISTIC', 'BEDROCK');
CREATE TYPE "ArtifactKind" AS ENUM (
  'BASELINE_RENDER',
  'CANDIDATE_RENDER',
  'ALIGNED_CANDIDATE',
  'OVERLAY',
  'ADDED_MASK',
  'REMOVED_MASK',
  'EVIDENCE_CROP',
  'REPORT'
);
CREATE TYPE "ChangeType" AS ENUM ('ADDED', 'REMOVED', 'MODIFIED', 'TEXT_CHANGED');
CREATE TYPE "ChangeCategory" AS ENUM (
  'WALL_LINEWORK',
  'DOOR',
  'WINDOW',
  'FIXTURE_SYMBOL',
  'DIMENSION',
  'TEXT_NOTE',
  'ROOM_LABEL',
  'UNKNOWN'
);
CREATE TYPE "ChangeSource" AS ENUM ('RULES', 'ONNX', 'OCR', 'HYBRID');

CREATE TABLE "profiles" (
  "id" UUID NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "project_code" TEXT,
  "description" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_name_not_blank" CHECK (length(btrim("name")) BETWEEN 1 AND 160)
);

CREATE TABLE "plan_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "revision_code" TEXT,
  "role" "RevisionRole" NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" BIGINT NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "storage_provider" "StorageProvider" NOT NULL,
  "storage_key" TEXT NOT NULL,
  "page_count" INTEGER NOT NULL,
  "selected_page" INTEGER,
  "width_px" INTEGER,
  "height_px" INTEGER,
  "upload_status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plan_revisions_byte_size_positive" CHECK ("byte_size" > 0),
  CONSTRAINT "plan_revisions_page_count_positive" CHECK ("page_count" > 0),
  CONSTRAINT "plan_revisions_selected_page_valid" CHECK (
    "selected_page" IS NULL OR ("selected_page" > 0 AND "selected_page" <= "page_count")
  ),
  CONSTRAINT "plan_revisions_dimensions_positive" CHECK (
    ("width_px" IS NULL OR "width_px" > 0) AND ("height_px" IS NULL OR "height_px" > 0)
  ),
  CONSTRAINT "plan_revisions_checksum_sha256_valid" CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "plan_revisions_storage_key_not_blank" CHECK (length(btrim("storage_key")) > 0)
);

CREATE TABLE "analyses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "baseline_revision_id" UUID NOT NULL,
  "candidate_revision_id" UUID NOT NULL,
  "requested_by" UUID NOT NULL,
  "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "current_stage" TEXT NOT NULL DEFAULT 'queued',
  "priority" SMALLINT NOT NULL DEFAULT 0,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "lease_owner" TEXT,
  "lease_expires_at" TIMESTAMPTZ(6),
  "heartbeat_at" TIMESTAMPTZ(6),
  "next_attempt_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "error_code" TEXT,
  "error_message" TEXT,
  "schema_version" TEXT NOT NULL DEFAULT '1.0',
  "engine_version" TEXT NOT NULL DEFAULT 'pending',
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "summary_provider" "SummaryProvider" NOT NULL DEFAULT 'DETERMINISTIC',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analyses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analyses_distinct_revisions" CHECK ("baseline_revision_id" <> "candidate_revision_id"),
  CONSTRAINT "analyses_progress_range" CHECK ("progress" BETWEEN 0 AND 100),
  CONSTRAINT "analyses_attempts_valid" CHECK (
    "attempt_count" >= 0 AND "max_attempts" > 0 AND "attempt_count" <= "max_attempts"
  ),
  CONSTRAINT "analyses_lease_fields_coherent" CHECK (
    ("lease_owner" IS NULL AND "lease_expires_at" IS NULL)
    OR ("lease_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
  )
);

CREATE TABLE "analysis_artifacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "analysis_id" UUID NOT NULL,
  "kind" "ArtifactKind" NOT NULL,
  "storage_provider" "StorageProvider" NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "width_px" INTEGER,
  "height_px" INTEGER,
  "byte_size" BIGINT,
  "checksum_sha256" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analysis_artifacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analysis_artifacts_dimensions_positive" CHECK (
    ("width_px" IS NULL OR "width_px" > 0) AND ("height_px" IS NULL OR "height_px" > 0)
  ),
  CONSTRAINT "analysis_artifacts_byte_size_positive" CHECK ("byte_size" IS NULL OR "byte_size" > 0),
  CONSTRAINT "analysis_artifacts_checksum_valid" CHECK (
    "checksum_sha256" IS NULL OR "checksum_sha256" ~ '^[a-f0-9]{64}$'
  )
);

CREATE TABLE "detected_changes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "analysis_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "change_type" "ChangeType" NOT NULL,
  "category" "ChangeCategory" NOT NULL,
  "source" "ChangeSource" NOT NULL,
  "x" REAL NOT NULL,
  "y" REAL NOT NULL,
  "width" REAL NOT NULL,
  "height" REAL NOT NULL,
  "polygon" JSONB,
  "confidence" REAL NOT NULL,
  "old_text" TEXT,
  "new_text" TEXT,
  "text_confidence" REAL,
  "affected_trades" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "quantity_delta" DECIMAL,
  "unit" TEXT,
  "impact" TEXT,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "detected_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "detected_changes_sequence_positive" CHECK ("sequence" > 0),
  CONSTRAINT "detected_changes_box_normalized" CHECK (
    "x" BETWEEN 0 AND 1
    AND "y" BETWEEN 0 AND 1
    AND "width" > 0
    AND "width" <= 1
    AND "height" > 0
    AND "height" <= 1
    AND "x" + "width" <= 1
    AND "y" + "height" <= 1
  ),
  CONSTRAINT "detected_changes_confidence_range" CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "detected_changes_text_confidence_range" CHECK (
    "text_confidence" IS NULL OR "text_confidence" BETWEEN 0 AND 1
  )
);

CREATE TABLE "analysis_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "analysis_id" UUID NOT NULL,
  "executive_summary" TEXT NOT NULL,
  "structured_summary" JSONB NOT NULL,
  "provider" "SummaryProvider" NOT NULL DEFAULT 'DETERMINISTIC',
  "model_id" TEXT,
  "prompt_version" TEXT,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analysis_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID,
  "project_id" UUID,
  "analysis_id" UUID,
  "event_type" TEXT NOT NULL,
  "correlation_id" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_event_type_not_blank" CHECK (length(btrim("event_type")) > 0),
  CONSTRAINT "audit_events_correlation_not_blank" CHECK (length(btrim("correlation_id")) > 0)
);

CREATE INDEX "projects_owner_updated_idx" ON "projects"("owner_id", "updated_at" DESC);
CREATE INDEX "plan_revisions_project_created_idx" ON "plan_revisions"("project_id", "created_at");
CREATE UNIQUE INDEX "plan_revisions_storage_key_unique" ON "plan_revisions"("storage_provider", "storage_key");
CREATE INDEX "analyses_queue_idx" ON "analyses"("status", "next_attempt_at", "priority" DESC, "created_at");
CREATE INDEX "analyses_lease_idx" ON "analyses"("status", "lease_expires_at");
CREATE INDEX "analyses_project_created_idx" ON "analyses"("project_id", "created_at" DESC);
CREATE INDEX "analysis_artifacts_analysis_idx" ON "analysis_artifacts"("analysis_id");
CREATE UNIQUE INDEX "analysis_artifacts_kind_key_unique" ON "analysis_artifacts"("analysis_id", "kind", "storage_key");
CREATE INDEX "detected_changes_filter_idx" ON "detected_changes"("analysis_id", "change_type", "category");
CREATE UNIQUE INDEX "detected_changes_analysis_sequence_unique" ON "detected_changes"("analysis_id", "sequence");
CREATE UNIQUE INDEX "analysis_reports_analysis_id_key" ON "analysis_reports"("analysis_id");
CREATE INDEX "audit_events_project_created_idx" ON "audit_events"("project_id", "created_at");
CREATE INDEX "audit_events_analysis_created_idx" ON "audit_events"("analysis_id", "created_at");

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_revisions"
  ADD CONSTRAINT "plan_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_baseline_revision_id_fkey" FOREIGN KEY ("baseline_revision_id") REFERENCES "plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_candidate_revision_id_fkey" FOREIGN KEY ("candidate_revision_id") REFERENCES "plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analysis_artifacts"
  ADD CONSTRAINT "analysis_artifacts_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "detected_changes"
  ADD CONSTRAINT "detected_changes_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_reports"
  ADD CONSTRAINT "analysis_reports_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "profiles"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "projects_set_updated_at" BEFORE UPDATE ON "projects"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "plan_revisions_set_updated_at" BEFORE UPDATE ON "plan_revisions"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "analyses_set_updated_at" BEFORE UPDATE ON "analyses"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "analysis_reports_set_updated_at" BEFORE UPDATE ON "analysis_reports"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO "public"."profiles" ("id", "display_name", "avatar_url")
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), NULLIF(split_part(NEW.email, '@', 1), ''), 'PlanDelta reviewer'),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', '')
  )
  ON CONFLICT ("id") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "plandelta_on_auth_user_created"
AFTER INSERT ON "auth"."users"
FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_auth_user"();

CREATE OR REPLACE FUNCTION "public"."validate_analysis_revisions"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "public"."plan_revisions"
    WHERE "id" = NEW.baseline_revision_id
      AND "project_id" = NEW.project_id
      AND "role" = 'BASELINE'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Baseline revision must belong to the analysis project and have BASELINE role.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "public"."plan_revisions"
    WHERE "id" = NEW.candidate_revision_id
      AND "project_id" = NEW.project_id
      AND "role" = 'CANDIDATE'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Candidate revision must belong to the analysis project and have CANDIDATE role.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "analyses_validate_revisions"
BEFORE INSERT OR UPDATE OF "project_id", "baseline_revision_id", "candidate_revision_id" ON "analyses"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_analysis_revisions"();

CREATE OR REPLACE FUNCTION "public"."claim_analysis"(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF "public"."analyses"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF length(btrim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'Worker id is required.' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds < 30 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Lease seconds must be between 30 and 3600.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT a.id
    FROM "public"."analyses" AS a
    WHERE a.status IN ('QUEUED', 'RETRYING')
      AND (a.next_attempt_at IS NULL OR a.next_attempt_at <= clock_timestamp())
      AND a.attempt_count < a.max_attempts
    ORDER BY a.priority DESC, a.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE "public"."analyses" AS a
  SET
    status = 'CLAIMED',
    current_stage = 'claimed',
    lease_owner = p_worker_id,
    lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
    heartbeat_at = clock_timestamp(),
    started_at = COALESCE(a.started_at, clock_timestamp()),
    attempt_count = a.attempt_count + 1,
    next_attempt_at = NULL
  FROM candidate
  WHERE a.id = candidate.id
  RETURNING a.*;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."heartbeat_analysis"(
  p_analysis_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Lease seconds must be between 30 and 3600.' USING ERRCODE = '22023';
  END IF;

  UPDATE "public"."analyses"
  SET
    heartbeat_at = clock_timestamp(),
    lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
  WHERE id = p_analysis_id
    AND lease_owner = p_worker_id
    AND status IN ('CLAIMED', 'PREPROCESSING', 'ALIGNING', 'DIFFING', 'OCR', 'CLASSIFYING', 'SUMMARIZING');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."recover_stale_analyses"()
RETURNS TABLE (requeued_count INTEGER, failed_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH recovered AS (
    UPDATE "public"."analyses"
    SET
      status = CASE WHEN attempt_count < max_attempts THEN 'RETRYING'::"AnalysisStatus" ELSE 'FAILED'::"AnalysisStatus" END,
      current_stage = CASE WHEN attempt_count < max_attempts THEN 'retry_scheduled' ELSE 'failed' END,
      next_attempt_at = CASE WHEN attempt_count < max_attempts THEN clock_timestamp() ELSE NULL END,
      completed_at = CASE WHEN attempt_count < max_attempts THEN NULL ELSE clock_timestamp() END,
      error_code = CASE WHEN attempt_count < max_attempts THEN NULL ELSE 'MAX_ATTEMPTS_EXHAUSTED' END,
      error_message = CASE WHEN attempt_count < max_attempts THEN NULL ELSE 'The analysis lease expired after the maximum number of attempts.' END,
      lease_owner = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL
    WHERE status IN ('CLAIMED', 'PREPROCESSING', 'ALIGNING', 'DIFFING', 'OCR', 'CLASSIFYING', 'SUMMARIZING')
      AND lease_expires_at < clock_timestamp()
    RETURNING status
  )
  SELECT
    count(*) FILTER (WHERE status = 'RETRYING')::INTEGER,
    count(*) FILTER (WHERE status = 'FAILED')::INTEGER
  FROM recovered;
END;
$$;

REVOKE ALL ON FUNCTION "public"."claim_analysis"(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."heartbeat_analysis"(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."recover_stale_analyses"() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."claim_analysis"(TEXT, INTEGER) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."heartbeat_analysis"(UUID, TEXT, INTEGER) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."recover_stale_analyses"() TO service_role, postgres;

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analyses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analysis_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "detected_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analysis_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON "profiles" FOR SELECT TO authenticated
USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON "profiles" FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON "profiles" FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "projects_select_owned" ON "projects" FOR SELECT TO authenticated
USING (auth.uid() = owner_id);
CREATE POLICY "projects_insert_owned" ON "projects" FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "projects_update_owned" ON "projects" FOR UPDATE TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "projects_delete_owned" ON "projects" FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "revisions_select_owned" ON "plan_revisions" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "revisions_insert_owned" ON "plan_revisions" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "revisions_update_owned" ON "plan_revisions" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "revisions_delete_owned" ON "plan_revisions" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "analyses_select_owned" ON "analyses" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "artifacts_select_owned" ON "analysis_artifacts" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "analyses" a
    JOIN "projects" p ON p.id = a.project_id
    WHERE a.id = analysis_id AND p.owner_id = auth.uid()
  )
);
CREATE POLICY "changes_select_owned" ON "detected_changes" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "analyses" a
    JOIN "projects" p ON p.id = a.project_id
    WHERE a.id = analysis_id AND p.owner_id = auth.uid()
  )
);
CREATE POLICY "reports_select_owned" ON "analysis_reports" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "analyses" a
    JOIN "projects" p ON p.id = a.project_id
    WHERE a.id = analysis_id AND p.owner_id = auth.uid()
  )
);
CREATE POLICY "audit_select_owned" ON "audit_events" FOR SELECT TO authenticated
USING (
  actor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM "projects" p WHERE p.id = project_id AND p.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM "analyses" a
    JOIN "projects" p ON p.id = a.project_id
    WHERE a.id = analysis_id AND p.owner_id = auth.uid()
  )
);

REVOKE ALL ON TABLE "profiles", "projects", "plan_revisions", "analyses", "analysis_artifacts", "detected_changes", "analysis_reports", "audit_events" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE "profiles" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "projects", "plan_revisions" TO authenticated;
GRANT SELECT (
  "id", "project_id", "baseline_revision_id", "candidate_revision_id", "requested_by", "status",
  "progress", "current_stage", "attempt_count", "max_attempts", "started_at", "completed_at",
  "error_code", "error_message", "schema_version", "engine_version", "configuration", "metrics",
  "warnings", "summary_provider", "created_at", "updated_at"
) ON TABLE "analyses" TO authenticated;
GRANT SELECT ON TABLE "analysis_artifacts", "detected_changes", "analysis_reports", "audit_events" TO authenticated;

COMMENT ON FUNCTION "public"."claim_analysis"(TEXT, INTEGER) IS
  'Atomically leases one eligible analysis using FOR UPDATE SKIP LOCKED. Server-side only.';
COMMENT ON TABLE "detected_changes" IS
  'Evidence-based detected regions. Geometry is normalized to the inclusive range 0..1.';
