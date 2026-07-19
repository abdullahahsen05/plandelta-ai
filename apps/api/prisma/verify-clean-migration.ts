import { randomUUID } from "node:crypto";
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
  "knowledge_documents",
  "knowledge_document_versions",
  "knowledge_chunks",
  "ingestion_jobs",
  "conversations",
  "messages",
  "agent_runs",
  "agent_steps",
  "citations",
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
  await client.query("BEGIN");
  const suffix = randomUUID().replaceAll("-", "");
  const verificationSchema = `plandelta_verify_${suffix}`;
  const quotedSchema = `"${verificationSchema}"`;
  const verificationTrigger = `plandelta_verify_auth_${suffix}`;
  await client.query(`CREATE SCHEMA ${quotedSchema}`);
  await client.query(`SET LOCAL search_path = ${quotedSchema}, auth, extensions, pg_temp`);

  const isolatedMigrationSql = migrationSql
    .replaceAll('"public"', quotedSchema)
    .replaceAll(
      "SET search_path = public, pg_temp",
      `SET search_path = ${verificationSchema}, pg_temp`,
    )
    .replaceAll('"plandelta_on_auth_user_created"', `"${verificationTrigger}"`);
  await client.query(isolatedMigrationSql);

  const tables = await client.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [verificationSchema, applicationTables],
  );
  const policies = await client.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM pg_policies
     WHERE schemaname = $1 AND tablename = ANY($2::text[])`,
    [verificationSchema, applicationTables],
  );
  const queueFunctions = await client.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = $1
       AND p.proname = ANY($2::text[])`,
    [
      verificationSchema,
      ["claim_analysis", "heartbeat_analysis", "recover_stale_analyses", "hybrid_search_knowledge"],
    ],
  );

  const tableCount = tables.rows[0]?.count ?? 0;
  const policyCount = policies.rows[0]?.count ?? 0;
  const queueFunctionCount = queueFunctions.rows[0]?.count ?? 0;

  if (tableCount !== applicationTables.length) {
    throw new Error(`Expected ${applicationTables.length} PlanDelta tables; found ${tableCount}.`);
  }
  if (policyCount < 24) {
    throw new Error(`Expected ownership RLS policies; found only ${policyCount}.`);
  }
  if (queueFunctionCount !== 4) {
    throw new Error(`Expected 4 queue/retrieval functions; found ${queueFunctionCount}.`);
  }

  await client.query("ROLLBACK");
  rolledBack = true;
  const schemaAfterRollback = await client.query<{ count: number }>(
    "SELECT count(*)::integer AS count FROM pg_namespace WHERE nspname = $1",
    [verificationSchema],
  );
  if ((schemaAfterRollback.rows[0]?.count ?? 0) !== 0) {
    throw new Error("The isolated migration verification schema survived rollback.");
  }
  process.stdout.write(
    `Clean isolated migration passed: ${tableCount} tables, ${policyCount} policies, ${queueFunctionCount} queue/retrieval functions; transaction rolled back.\n`,
  );
} finally {
  if (!rolledBack) {
    await client.query("ROLLBACK").catch(() => undefined);
  }
  await client.end();
}
