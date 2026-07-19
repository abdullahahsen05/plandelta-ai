import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const runId = process.argv[2];
if (
  !runId ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)
) {
  throw new Error("Usage: pnpm --filter @plandelta/api db:inspect-agent-run <run-uuid>");
}
const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
if (!directDatabaseUrl) throw new Error("DIRECT_DATABASE_URL is required.");
const connectionUrl = new URL(directDatabaseUrl);
connectionUrl.searchParams.set("uselibpqcompat", "true");
const client = new pg.Client({ connectionString: connectionUrl.toString() });

await client.connect();
try {
  const run = await client.query(
    `SELECT id, project_id, analysis_id, status::text, analysis_profile::text,
            profile_version, correlation_id, selected_specialists, model_turn_count,
            tool_call_count, retrieved_chunk_count, repair_count, input_tokens,
            output_tokens, estimated_cost_usd, verifier_outcome, failure_code,
            created_at, started_at, completed_at
     FROM public.agent_runs
     WHERE id = $1`,
    [runId],
  );
  if (!run.rows[0]) throw new Error("The agent run was not found.");
  const steps = await client.query(
    `SELECT sequence, node_name, node_version, event_type, status::text,
            safe_summary, reason_code, duration_ms, input_tokens, output_tokens,
            estimated_cost_usd, error_code, created_at
     FROM public.agent_steps
     WHERE agent_run_id = $1
     ORDER BY sequence
     LIMIT 100`,
    [runId],
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        notice:
          "Redacted operator trace. Questions, answers, prompts, chunks, URLs, and credentials are excluded.",
        run: run.rows[0],
        steps: steps.rows,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await client.end();
}
