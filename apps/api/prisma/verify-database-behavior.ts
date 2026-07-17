import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
if (!directDatabaseUrl) {
  throw new Error("DIRECT_DATABASE_URL is required for database behavior verification.");
}

const connectionUrl = new URL(directDatabaseUrl);
connectionUrl.searchParams.set("uselibpqcompat", "true");
const connectionString = connectionUrl.toString();

function createClient() {
  return new pg.Client({ connectionString });
}

async function insertSyntheticAuthUser(client: pg.Client, id: string, label: string) {
  await client.query(
    `INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
      '', clock_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', $3::text), clock_timestamp(), clock_timestamp()
    )`,
    [id, `plandelta-${label}-${id}@example.invalid`, `PlanDelta ${label}`],
  );
}

async function setAuthenticatedUser(client: pg.Client, userId: string) {
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}

async function verifyRlsIsolation() {
  const client = createClient();
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const projectId = randomUUID();
  await client.connect();

  let rolledBack = false;
  try {
    await client.query("BEGIN");
    await insertSyntheticAuthUser(client, ownerId, "owner");
    await insertSyntheticAuthUser(client, otherId, "other");
    await client.query(
      `INSERT INTO public.projects (id, owner_id, name, project_code)
       VALUES ($1, $2, 'RLS owner project', 'RLS-VERIFY')`,
      [projectId, ownerId],
    );

    await client.query("SET LOCAL ROLE authenticated");
    await setAuthenticatedUser(client, ownerId);
    const ownView = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM public.projects WHERE id = $1",
      [projectId],
    );

    await setAuthenticatedUser(client, otherId);
    const crossView = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM public.projects WHERE id = $1",
      [projectId],
    );
    const crossUpdate = await client.query(
      "UPDATE public.projects SET name = 'unauthorized' WHERE id = $1",
      [projectId],
    );
    const ownInsert = await client.query(
      "INSERT INTO public.projects (owner_id, name) VALUES ($1, 'Other owner project')",
      [otherId],
    );

    await client.query("SAVEPOINT cross_insert");
    let crossInsertDenied = false;
    try {
      await client.query(
        "INSERT INTO public.projects (owner_id, name) VALUES ($1, 'Cross-owner project')",
        [ownerId],
      );
    } catch {
      crossInsertDenied = true;
      await client.query("ROLLBACK TO SAVEPOINT cross_insert");
    }

    const leasePrivileges = await client.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM information_schema.column_privileges
       WHERE table_schema = 'public'
         AND table_name = 'analyses'
         AND grantee = 'authenticated'
         AND column_name = ANY($1::text[])`,
      [["lease_owner", "lease_expires_at", "heartbeat_at", "next_attempt_at"]],
    );

    if ((ownView.rows[0]?.count ?? 0) !== 1) throw new Error("Owner could not read their project.");
    if ((crossView.rows[0]?.count ?? 0) !== 0)
      throw new Error("Cross-user project read was not denied.");
    if ((crossUpdate.rowCount ?? 0) !== 0)
      throw new Error("Cross-user project update was not denied.");
    if ((ownInsert.rowCount ?? 0) !== 1)
      throw new Error("Owner could not create their own project.");
    if (!crossInsertDenied) throw new Error("Cross-user project insert was not denied.");
    if ((leasePrivileges.rows[0]?.count ?? 0) !== 0) {
      throw new Error("Authenticated browser role can read queue lease columns.");
    }

    await client.query("ROLLBACK");
    rolledBack = true;
  } finally {
    if (!rolledBack) await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
}

async function verifyQueueLeasing() {
  const setupClient = createClient();
  const workerA = createClient();
  const workerB = createClient();
  const userId = randomUUID();
  const projectId = randomUUID();
  const analysisIds = [randomUUID(), randomUUID()];
  const revisionIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

  await setupClient.connect();
  try {
    await insertSyntheticAuthUser(setupClient, userId, "queue");
    await setupClient.query(
      "INSERT INTO public.projects (id, owner_id, name, project_code) VALUES ($1, $2, 'Queue verification', 'QUEUE-VERIFY')",
      [projectId, userId],
    );

    for (let index = 0; index < revisionIds.length; index += 1) {
      const isBaseline = index % 2 === 0;
      await setupClient.query(
        `INSERT INTO public.plan_revisions (
          id, project_id, label, revision_code, role, original_filename, mime_type, byte_size,
          checksum_sha256, storage_provider, storage_key, page_count, selected_page, upload_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'image/png', 1024, $7, 'LOCAL', $8, 1, 1, 'READY')`,
        [
          revisionIds[index],
          projectId,
          isBaseline ? "Baseline" : "Candidate",
          `R${index + 1}`,
          isBaseline ? "BASELINE" : "CANDIDATE",
          `queue-${index + 1}.png`,
          `${index}`.repeat(64),
          `queue-verification/${revisionIds[index]}.png`,
        ],
      );
    }

    for (let index = 0; index < analysisIds.length; index += 1) {
      await setupClient.query(
        `INSERT INTO public.analyses (
          id, project_id, baseline_revision_id, candidate_revision_id, requested_by, priority
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          analysisIds[index],
          projectId,
          revisionIds[index * 2],
          revisionIds[index * 2 + 1],
          userId,
          index,
        ],
      );
    }

    await Promise.all([workerA.connect(), workerB.connect()]);
    const [claimA, claimB] = await Promise.all([
      workerA.query<{ id: string }>(
        "SELECT id FROM public.claim_analysis('verification-worker-a', 60)",
      ),
      workerB.query<{ id: string }>(
        "SELECT id FROM public.claim_analysis('verification-worker-b', 60)",
      ),
    ]);
    const claimedIds = [claimA.rows[0]?.id, claimB.rows[0]?.id].filter((value): value is string =>
      Boolean(value),
    );

    if (claimedIds.length !== 2 || new Set(claimedIds).size !== 2) {
      throw new Error("Concurrent workers did not receive two distinct analyses.");
    }

    const wrongHeartbeat = await setupClient.query<{ heartbeat_analysis: boolean }>(
      "SELECT public.heartbeat_analysis($1, 'wrong-worker', 60)",
      [claimA.rows[0]?.id],
    );
    const validHeartbeat = await setupClient.query<{ heartbeat_analysis: boolean }>(
      "SELECT public.heartbeat_analysis($1, 'verification-worker-a', 60)",
      [claimA.rows[0]?.id],
    );
    if (wrongHeartbeat.rows[0]?.heartbeat_analysis !== false) {
      throw new Error("A worker renewed a lease it does not own.");
    }
    if (validHeartbeat.rows[0]?.heartbeat_analysis !== true) {
      throw new Error("The owning worker could not renew its lease.");
    }

    await setupClient.query(
      "UPDATE public.analyses SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE project_id = $1",
      [projectId],
    );
    const recovery = await setupClient.query<{ requeued_count: number; failed_count: number }>(
      "SELECT * FROM public.recover_stale_analyses()",
    );
    if (
      (recovery.rows[0]?.requeued_count ?? 0) < 2 ||
      (recovery.rows[0]?.failed_count ?? 0) !== 0
    ) {
      throw new Error("Stale leases did not recover to RETRYING as expected.");
    }
  } finally {
    await Promise.all([workerA.end().catch(() => undefined), workerB.end().catch(() => undefined)]);
    await setupClient
      .query("DELETE FROM auth.users WHERE id = $1", [userId])
      .catch(() => undefined);
    await setupClient.end();
  }
}

await verifyRlsIsolation();
await verifyQueueLeasing();
process.stdout.write(
  "Database behavior passed: cross-user RLS denied, lease columns protected, concurrent claims distinct, heartbeat ownership enforced, stale leases recovered.\n",
);
