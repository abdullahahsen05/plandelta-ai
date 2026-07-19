DROP FUNCTION "public"."claim_ingestion_job"(TEXT, INTEGER);
DROP FUNCTION "public"."claim_agent_run"(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION "public"."claim_ingestion_job"(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300,
  p_project_id UUID DEFAULT NULL
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
      AND (p_project_id IS NULL OR job.project_id = p_project_id)
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

CREATE OR REPLACE FUNCTION "public"."claim_agent_run"(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 120,
  p_project_id UUID DEFAULT NULL
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
      AND (p_project_id IS NULL OR run.project_id = p_project_id)
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

REVOKE ALL ON FUNCTION "public"."claim_ingestion_job"(TEXT, INTEGER, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."claim_agent_run"(TEXT, INTEGER, UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."claim_ingestion_job"(TEXT, INTEGER, UUID)
TO service_role, postgres;
GRANT EXECUTE ON FUNCTION "public"."claim_agent_run"(TEXT, INTEGER, UUID)
TO service_role, postgres;

COMMENT ON FUNCTION "public"."claim_ingestion_job"(TEXT, INTEGER, UUID) IS
  'Atomically leases one eligible ingestion job. Optional project scope is reserved for isolated operational verification.';
COMMENT ON FUNCTION "public"."claim_agent_run"(TEXT, INTEGER, UUID) IS
  'Atomically leases one eligible agent run. Optional project scope is reserved for isolated operational verification.';
