import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadDotenv } from "dotenv";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for seeding.");

const connectionUrl = new URL(databaseUrl);
connectionUrl.searchParams.set("uselibpqcompat", "true");
const connectionString = connectionUrl.toString();

const ids = {
  user: "00000000-0000-4000-8000-000000000101",
  project: "00000000-0000-4000-8000-000000000201",
  baseline: "00000000-0000-4000-8000-000000000301",
  candidate: "00000000-0000-4000-8000-000000000302",
  analysis: "00000000-0000-4000-8000-000000000401",
} as const;

const authClient = new pg.Client({ connectionString });
await authClient.connect();
try {
  await authClient.query(
    `INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
      'plandelta-built-in-sample@example.invalid', '', clock_timestamp(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"PlanDelta Sample"}'::jsonb, clock_timestamp(), clock_timestamp()
    ) ON CONFLICT (id) DO NOTHING`,
    [ids.user],
  );
} finally {
  await authClient.end();
}

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 4 }),
});

try {
  await database.profile.upsert({
    where: { id: ids.user },
    create: { id: ids.user, displayName: "PlanDelta Sample" },
    update: { displayName: "PlanDelta Sample" },
  });
  await database.project.upsert({
    where: { id: ids.project },
    create: {
      id: ids.project,
      ownerId: ids.user,
      name: "Northline Office Renovation",
      projectCode: "PD-24017",
      description: "Built-in non-sensitive sample project for deterministic revision evidence.",
    },
    update: {
      name: "Northline Office Renovation",
      projectCode: "PD-24017",
      description: "Built-in non-sensitive sample project for deterministic revision evidence.",
    },
  });

  const sharedRevision = {
    projectId: ids.project,
    label: "Level 02 floor plan",
    originalName: "northline-a2-14.png",
    mimeType: "image/png",
    byteSize: 1024n,
    checksumSha256: "a".repeat(64),
    storageProvider: "LOCAL" as const,
    pageCount: 1,
    selectedPage: 1,
    widthPx: 1600,
    heightPx: 1120,
    uploadStatus: "READY" as const,
    metadata: { builtInSample: true, committedFixture: true },
  };

  await database.planRevision.upsert({
    where: { id: ids.baseline },
    create: {
      ...sharedRevision,
      id: ids.baseline,
      role: "BASELINE",
      revisionCode: "03",
      storageKey: "samples/northline/rev-03.png",
    },
    update: {
      label: sharedRevision.label,
      revisionCode: "03",
      storageKey: "samples/northline/rev-03.png",
      metadata: sharedRevision.metadata,
    },
  });
  await database.planRevision.upsert({
    where: { id: ids.candidate },
    create: {
      ...sharedRevision,
      id: ids.candidate,
      role: "CANDIDATE",
      revisionCode: "04",
      storageKey: "samples/northline/rev-04.png",
    },
    update: {
      label: sharedRevision.label,
      revisionCode: "04",
      storageKey: "samples/northline/rev-04.png",
      metadata: sharedRevision.metadata,
    },
  });
  await database.analysis.upsert({
    where: { id: ids.analysis },
    create: {
      id: ids.analysis,
      projectId: ids.project,
      baselineRevisionId: ids.baseline,
      candidateRevisionId: ids.candidate,
      requestedBy: ids.user,
      status: "COMPLETED",
      progress: 100,
      currentStage: "completed",
      attemptCount: 1,
      maxAttempts: 3,
      startedAt: new Date("2026-07-16T14:31:00.000Z"),
      completedAt: new Date("2026-07-16T14:32:00.000Z"),
      engineVersion: "deterministic-sample@0.1.0",
      configuration: { page: 1, sensitivity: "balanced", ocrEnabled: true },
      metrics: { fixture: true },
      warnings: ["Precomputed evidence from committed sample drawings."],
    },
    update: {
      status: "COMPLETED",
      progress: 100,
      currentStage: "completed",
      engineVersion: "deterministic-sample@0.1.0",
    },
  });

  const [projectCount, revisionCount, analysisCount] = await Promise.all([
    database.project.count({ where: { id: ids.project } }),
    database.planRevision.count({ where: { id: { in: [ids.baseline, ids.candidate] } } }),
    database.analysis.count({ where: { id: ids.analysis } }),
  ]);
  if (projectCount !== 1 || revisionCount !== 2 || analysisCount !== 1) {
    throw new Error("The built-in sample seed did not converge to its expected records.");
  }
} finally {
  await database.$disconnect();
}

process.stdout.write("Idempotent built-in sample account and project seed passed.\n");
