CREATE OR REPLACE FUNCTION "public"."claim_analysis"(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300,
  p_project_id UUID DEFAULT NULL
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
      AND (
        (
          p_project_id IS NULL
          AND coalesce(a.configuration ->> 'queueVisibility', 'global') = 'global'
        )
        OR
        (
          p_project_id IS NOT NULL
          AND a.project_id = p_project_id
          AND coalesce(a.configuration ->> 'queueVisibility', 'global') IN ('global', 'scoped')
        )
      )
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

COMMENT ON FUNCTION "public"."claim_analysis"(TEXT, INTEGER, UUID) IS
  'Atomically leases one eligible analysis using FOR UPDATE SKIP LOCKED. Scoped-only verification jobs are invisible to the normal worker and require an explicit project scope. Server-side only.';
