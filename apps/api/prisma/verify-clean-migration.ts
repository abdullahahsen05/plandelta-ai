import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
if (!directDatabaseUrl) {
  throw new Error("DIRECT_DATABASE_URL is required for clean migration verification.");
}

const connectionUrl = new URL(directDatabaseUrl);
connectionUrl.searchParams.set("uselibpqcompat", "true");

const applicationTables = [
  "profiles",
  "projects",
  "plan_revisions",
  "analyses",
  "analysis_artifacts",
  "detected_changes",
  "analysis_reports",
  "audit_events",
] as const;

const migrationsDirectory = resolve(import.meta.dirname, "migrations");
const migrationDirectories = (await readdir(migrationsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (migrationDirectories.length === 0) {
  throw new Error("No versioned migration directories were found.");
}

const migrationSql = (
  await Promise.all(
    migrationDirectories.map((directory) =>
      readFile(resolve(migrationsDirectory, directory, "migration.sql"), "utf8"),
    ),
  )
).join("\n");

const client = new pg.Client({ connectionString: connectionUrl.toString() });
await client.connect();

let rolledBack = false;
try {
  const existing = await client.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [applicationTables],
  );

  const existingCount = existing.rows[0]?.count ?? 0;
  if (existingCount > 0) {
    throw new Error(
      `Clean migration verification requires no existing PlanDelta tables; found ${existingCount}.`,
    );
  }

  await client.query("BEGIN");
  await client.query(migrationSql);

  const tables = await client.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [applicationTables],
  );
  const policies = await client.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [applicationTables],
  );
  const queueFunctions = await client.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY($1::text[])`,
    [["claim_analysis", "heartbeat_analysis", "recover_stale_analyses"]],
  );

  const tableCount = tables.rows[0]?.count ?? 0;
  const policyCount = policies.rows[0]?.count ?? 0;
  const queueFunctionCount = queueFunctions.rows[0]?.count ?? 0;

  if (tableCount !== applicationTables.length) {
    throw new Error(`Expected ${applicationTables.length} PlanDelta tables; found ${tableCount}.`);
  }
  if (policyCount < 10) {
    throw new Error(`Expected ownership RLS policies; found only ${policyCount}.`);
  }
  if (queueFunctionCount !== 3) {
    throw new Error(`Expected 3 queue functions; found ${queueFunctionCount}.`);
  }

  await client.query("ROLLBACK");
  rolledBack = true;
  process.stdout.write(
    `Clean migration transaction passed: ${tableCount} tables, ${policyCount} policies, ${queueFunctionCount} queue functions; transaction rolled back.\n`,
  );
} finally {
  if (!rolledBack) {
    await client.query("ROLLBACK").catch(() => undefined);
  }
  await client.end();
}
