ALTER TABLE "agent_runs"
ADD COLUMN "next_attempt_at" TIMESTAMPTZ(6);

ALTER TABLE "messages"
ADD COLUMN "answer_status" TEXT,
ADD COLUMN "confidence" TEXT,
ADD COLUMN "rfi_draft" JSONB;

DROP INDEX "agent_runs_queue_idx";
CREATE INDEX "agent_runs_queue_idx"
ON "agent_runs"("status", "next_attempt_at", "created_at");

CREATE OR REPLACE FUNCTION "public"."claim_ingestion_job"(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF "public"."ingestion_jobs"
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
    SELECT job.id
    FROM "public"."ingestion_jobs" AS job
    WHERE job.status IN ('queued', 'retrying')
      AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= clock_timestamp())
      AND job.attempt_count < job.max_attempts
    ORDER BY job.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE "public"."ingestion_jobs" AS job
  SET status = 'claimed',
      current_stage = 'claimed',
      lease_owner = p_worker_id,
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      heartbeat_at = clock_timestamp(),
      attempt_count = job.attempt_count + 1,
      next_attempt_at = NULL,
      failure_code = NULL
  FROM candidate
  WHERE job.id = candidate.id
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."heartbeat_ingestion_job"(
  p_job_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE "public"."ingestion_jobs"
    SET heartbeat_at = clock_timestamp(),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
    WHERE id = p_job_id
      AND lease_owner = p_worker_id
      AND status IN ('claimed', 'extracting', 'chunking', 'embedding')
      AND lease_expires_at > clock_timestamp()
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

CREATE OR REPLACE FUNCTION "public"."recover_stale_ingestion_jobs"()
RETURNS TABLE(requeued_count INTEGER, failed_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requeued INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  WITH recovered AS (
    UPDATE "public"."ingestion_jobs"
    SET status = CASE
          WHEN attempt_count < max_attempts THEN 'retrying'::"IngestionJobStatus"
          ELSE 'failed'::"IngestionJobStatus"
        END,
        current_stage = CASE WHEN attempt_count < max_attempts THEN 'retry_scheduled' ELSE 'failed' END,
        next_attempt_at = CASE
          WHEN attempt_count < max_attempts THEN clock_timestamp() + interval '5 seconds'
          ELSE NULL
        END,
        failure_code = CASE WHEN attempt_count < max_attempts THEN NULL ELSE 'KNOWLEDGE_INGESTION_FAILED' END,
        completed_at = CASE WHEN attempt_count < max_attempts THEN NULL ELSE clock_timestamp() END,
        lease_owner = NULL,
        lease_expires_at = NULL,
        heartbeat_at = NULL
    WHERE status IN ('claimed', 'extracting', 'chunking', 'embedding')
      AND lease_expires_at <= clock_timestamp()
    RETURNING status
  )
  SELECT
    count(*) FILTER (WHERE status = 'retrying'),
    count(*) FILTER (WHERE status = 'failed')
  INTO v_requeued, v_failed
  FROM recovered;
  RETURN QUERY SELECT v_requeued, v_failed;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."claim_agent_run"(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS SETOF "public"."agent_runs"
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
    SELECT run.id
    FROM "public"."agent_runs" AS run
    WHERE run.status = 'queued'
      AND run.cancellation_requested = false
      AND run.deadline_at > clock_timestamp()
      AND (run.next_attempt_at IS NULL OR run.next_attempt_at <= clock_timestamp())
      AND run.attempt_count < run.max_attempts
    ORDER BY run.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE "public"."agent_runs" AS run
  SET status = 'running',
      lease_owner = p_worker_id,
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      heartbeat_at = clock_timestamp(),
      started_at = COALESCE(run.started_at, clock_timestamp()),
      attempt_count = run.attempt_count + 1,
      next_attempt_at = NULL,
      failure_code = NULL
  FROM candidate
  WHERE run.id = candidate.id
  RETURNING run.*;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."heartbeat_agent_run"(
  p_run_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE "public"."agent_runs"
    SET heartbeat_at = clock_timestamp(),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
    WHERE id = p_run_id
      AND lease_owner = p_worker_id
      AND status IN ('running', 'verifying')
      AND cancellation_requested = false
      AND lease_expires_at > clock_timestamp()
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

CREATE OR REPLACE FUNCTION "public"."recover_stale_agent_runs"()
RETURNS TABLE(requeued_count INTEGER, failed_count INTEGER, cancelled_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requeued INTEGER := 0;
  v_failed INTEGER := 0;
  v_cancelled INTEGER := 0;
BEGIN
  WITH recovered AS (
    UPDATE "public"."agent_runs"
    SET status = CASE
          WHEN cancellation_requested THEN 'cancelled'::"AgentRunStatus"
          WHEN deadline_at <= clock_timestamp() THEN 'expired'::"AgentRunStatus"
          WHEN attempt_count < max_attempts THEN 'queued'::"AgentRunStatus"
          ELSE 'failed'::"AgentRunStatus"
        END,
        next_attempt_at = CASE
          WHEN NOT cancellation_requested
            AND deadline_at > clock_timestamp()
            AND attempt_count < max_attempts
          THEN clock_timestamp() + interval '5 seconds'
          ELSE NULL
        END,
        failure_code = CASE
          WHEN cancellation_requested THEN 'AGENT_CANCELLED'
          WHEN deadline_at <= clock_timestamp() THEN 'AGENT_TIMEOUT'
          WHEN attempt_count >= max_attempts THEN 'AGENT_MODEL_UNAVAILABLE'
          ELSE NULL
        END,
        completed_at = CASE
          WHEN cancellation_requested OR deadline_at <= clock_timestamp() OR attempt_count >= max_attempts
          THEN clock_timestamp()
          ELSE NULL
        END,
        lease_owner = NULL,
        lease_expires_at = NULL,
        heartbeat_at = NULL
    WHERE status IN ('running', 'verifying')
      AND lease_expires_at <= clock_timestamp()
    RETURNING status
  )
  SELECT
    count(*) FILTER (WHERE status = 'queued'),
    count(*) FILTER (WHERE status IN ('failed', 'expired')),
    count(*) FILTER (WHERE status = 'cancelled')
  INTO v_requeued, v_failed, v_cancelled
  FROM recovered;
  RETURN QUERY SELECT v_requeued, v_failed, v_cancelled;
END;
$$;

REVOKE ALL ON FUNCTION "public"."claim_ingestion_job"(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."heartbeat_ingestion_job"(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."recover_stale_ingestion_jobs"() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."claim_agent_run"(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."heartbeat_agent_run"(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."recover_stale_agent_runs"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "public"."claim_ingestion_job"(TEXT, INTEGER) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."heartbeat_ingestion_job"(UUID, TEXT, INTEGER) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."recover_stale_ingestion_jobs"() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."claim_agent_run"(TEXT, INTEGER) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."heartbeat_agent_run"(UUID, TEXT, INTEGER) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."recover_stale_agent_runs"() TO service_role, postgres;

COMMENT ON FUNCTION "public"."claim_ingestion_job"(TEXT, INTEGER) IS
  'Atomically leases one supporting-document ingestion job using FOR UPDATE SKIP LOCKED.';
COMMENT ON FUNCTION "public"."claim_agent_run"(TEXT, INTEGER) IS
  'Atomically leases one Evidence Copilot run using FOR UPDATE SKIP LOCKED.';
