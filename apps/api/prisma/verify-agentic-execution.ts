import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
if (!directDatabaseUrl) {
  throw new Error("DIRECT_DATABASE_URL is required for agentic execution verification.");
}
const connectionUrl = new URL(directDatabaseUrl);
connectionUrl.searchParams.set("uselibpqcompat", "true");

const client = new pg.Client({ connectionString: connectionUrl.toString() });
const ownerId = randomUUID();
const projectId = randomUUID();
const revisionIds = [randomUUID(), randomUUID()];
const analysisId = randomUUID();
const conversationId = randomUUID();
const messageId = randomUUID();
const runId = randomUUID();
const correlationId = randomUUID();
const startedAt = Date.now();

await client.connect();
try {
  await client.query(
    `INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
      '', clock_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Agent execution verifier"}'::jsonb, clock_timestamp(), clock_timestamp()
    )`,
    [ownerId, `plandelta-agent-execution-${ownerId}@example.invalid`],
  );
  await client.query(
    `INSERT INTO public.projects (id, owner_id, name, project_code)
     VALUES ($1, $2, 'Agent execution verification', 'AGENT-EXEC-VERIFY')`,
    [projectId, ownerId],
  );
  for (let index = 0; index < revisionIds.length; index += 1) {
    await client.query(
      `INSERT INTO public.plan_revisions (
        id, project_id, label, role, original_filename, mime_type, byte_size,
        checksum_sha256, storage_provider, storage_key, page_count, selected_page, upload_status
      ) VALUES (
        $1, $2, $3, $4, $5, 'image/png', 1024, $6, 'LOCAL', $7, 1, 1, 'READY'
      )`,
      [
        revisionIds[index],
        projectId,
        index === 0 ? "Baseline" : "Candidate",
        index === 0 ? "BASELINE" : "CANDIDATE",
        `agent-execution-${index}.png`,
        `${index + 7}`.repeat(64),
        `agent-execution/${revisionIds[index]}.png`,
      ],
    );
  }
  await client.query(
    `INSERT INTO public.analyses (
      id, project_id, baseline_revision_id, candidate_revision_id, requested_by,
      status, progress, current_stage, started_at, completed_at, engine_version
    ) VALUES (
      $1, $2, $3, $4, $5, 'COMPLETED', 100, 'completed',
      clock_timestamp(), clock_timestamp(), 'verification'
    )`,
    [analysisId, projectId, revisionIds[0], revisionIds[1], ownerId],
  );
  await client.query(
    `INSERT INTO public.conversations (id, project_id, analysis_id, owner_id, title)
     VALUES ($1, $2, $3, $4, 'Agent restart verification')`,
    [conversationId, projectId, analysisId, ownerId],
  );
  await client.query(
    `INSERT INTO public.messages (
      id, conversation_id, author_id, role, message_type, status, content, idempotency_key
    ) VALUES (
      $1, $2, $3, 'user', 'question', 'completed',
      'What changed in the drawing?', $4
    )`,
    [messageId, conversationId, ownerId, randomUUID()],
  );
  await client.query(
    `INSERT INTO public.agent_runs (
      id, conversation_id, user_message_id, project_id, analysis_id, analysis_profile,
      profile_version, deadline_at, next_attempt_at, correlation_id
    ) VALUES (
      $1, $2, $3, $4, $5, 'construction_drawing', '1.0',
      clock_timestamp() + interval '5 minutes',
      clock_timestamp() + interval '10 seconds',
      $6
    )`,
    [runId, conversationId, messageId, projectId, analysisId, correlationId],
  );
  await client.query(
    `INSERT INTO public.agent_steps (
      agent_run_id, sequence, node_name, node_version, event_type, status, safe_summary
    ) VALUES ($1, 1, 'queue', '1', 'run.queued', 'completed', 'Evidence run queued.')`,
    [runId],
  );

  const timeoutAt = Date.now() + 120_000;
  let terminalStatus = "queued";
  while (Date.now() < timeoutAt) {
    const status = await client.query<{ status: string }>(
      "SELECT status::text FROM public.agent_runs WHERE id = $1",
      [runId],
    );
    terminalStatus = status.rows[0]?.status ?? "missing";
    if (["completed", "failed", "cancelled", "expired"].includes(terminalStatus)) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }

  const result = await client.query<{
    status: string;
    assistant_message_id: string | null;
    failure_code: string | null;
    verifier_outcome: string | null;
    assistant_count: number;
    citation_count: number;
    step_count: number;
  }>(
    `SELECT r.status::text,
            r.assistant_message_id,
            r.failure_code,
            r.verifier_outcome,
            (SELECT count(*)::integer FROM public.messages m
             WHERE m.conversation_id = r.conversation_id AND m.role = 'assistant') AS assistant_count,
            (SELECT count(*)::integer FROM public.citations c
             WHERE c.agent_run_id = r.id) AS citation_count,
            (SELECT count(*)::integer FROM public.agent_steps s
             WHERE s.agent_run_id = r.id) AS step_count
     FROM public.agent_runs r
     WHERE r.id = $1`,
    [runId],
  );
  const verified = result.rows[0];
  if (
    terminalStatus !== "completed" ||
    !verified?.assistant_message_id ||
    verified.assistant_count !== 1 ||
    verified.step_count < 2 ||
    verified.verifier_outcome !== "approved"
  ) {
    throw new Error(
      `Agentic execution failed safely: status=${terminalStatus}, code=${verified?.failure_code ?? "none"}, assistants=${verified?.assistant_count ?? 0}, steps=${verified?.step_count ?? 0}.`,
    );
  }
  process.stdout.write(
    `Agentic execution passed: one durable run, one assistant message, ${verified.step_count} safe steps, ${verified.citation_count} verified citations, ${Date.now() - startedAt} ms.\n`,
  );
} finally {
  await client.query("DELETE FROM public.projects WHERE id = $1", [projectId]);
  await client.query("DELETE FROM auth.users WHERE id = $1", [ownerId]);
  await client.end();
}
