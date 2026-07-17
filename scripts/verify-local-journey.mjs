import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";

const repositoryRoot = resolve(import.meta.dirname, "..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing required variables: ${missing.join(", ")}`);

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);
const apiUrl = configuredApiUrl.endsWith("/v1") ? configuredApiUrl : `${configuredApiUrl}/v1`;
const suffix = randomUUID();
const email = `plandelta-local-${suffix}@example.invalid`;
const password = `Local-${randomUUID()}-9a!`;
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const browser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let userId;
let projectId;
let analysisId;

async function api(path, token, init = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "x-correlation-id": randomUUID(),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      `${init.method ?? "GET"} ${path} failed (${response.status}): ${body?.error?.code ?? "UNKNOWN"}`,
    );
  return body;
}

async function upload(token, role, filename) {
  const bytes = await readFile(resolve(repositoryRoot, "samples", "vision", filename));
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "image/png" }), filename);
  form.set("label", role === "BASELINE" ? "Golden baseline" : "Golden added-wall candidate");
  form.set("role", role);
  form.set("selectedPage", "1");
  return api(`/projects/${projectId}/revisions`, token, { method: "POST", body: form });
}

async function verify() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user)
    throw created.error ?? new Error("Synthetic user creation failed.");
  userId = created.data.user.id;
  const signedIn = await browser.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session)
    throw signedIn.error ?? new Error("Synthetic sign-in failed.");
  const token = signedIn.data.session.access_token;

  const project = await api("/projects", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Local release journey", projectCode: "E2E-LOCAL" }),
  });
  projectId = project.id;
  const baseline = await upload(token, "BASELINE", "baseline.png");
  const candidate = await upload(token, "CANDIDATE", "added-wall.png");
  const analysis = await api(`/projects/${projectId}/analyses`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      baselineRevisionId: baseline.id,
      candidateRevisionId: candidate.id,
      configuration: { page: 1, sensitivity: "balanced", ocrEnabled: true, classifier: "auto" },
    }),
  });
  analysisId = analysis.id;

  const deadline = Date.now() + 240_000;
  let completed = analysis;
  while (!new Set(["COMPLETED", "FAILED"]).has(completed.status) && Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
    completed = await api(`/analyses/${analysisId}`, token);
  }
  if (completed.status !== "COMPLETED")
    throw new Error(`Analysis ended as ${completed.status}: ${completed.errorCode ?? "timeout"}`);

  const [changes, artifacts, report] = await Promise.all([
    api(`/analyses/${analysisId}/changes?limit=100`, token),
    api(`/analyses/${analysisId}/artifacts`, token),
    api(`/analyses/${analysisId}/report`, token),
  ]);
  if (changes.items.length < 1)
    throw new Error("Golden changed drawing produced no evidence regions.");
  const requiredKinds = ["BASELINE_RENDER", "ALIGNED_CANDIDATE", "OVERLAY", "EVIDENCE_CROP"];
  for (const kind of requiredKinds) {
    if (!artifacts.some((artifact) => artifact.kind === kind))
      throw new Error(`Missing ${kind} artifact.`);
  }
  const evidence = artifacts.find((artifact) => artifact.kind === "EVIDENCE_CROP");
  const download = await fetch(`${apiUrl}/artifacts/${evidence.id}/download`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!download.ok || !download.headers.get("content-type")?.startsWith("image/png"))
    throw new Error("Protected evidence download failed.");
  if (!report.executiveSummary.includes("evidence-based revision"))
    throw new Error("Deterministic report was not generated from evidence.");

  console.log(
    JSON.stringify({
      result: "passed",
      status: completed.status,
      changes: changes.items.length,
      artifacts: artifacts.length,
      reportProvider: report.provider,
      engineVersion: completed.engineVersion,
    }),
  );
}

try {
  await verify();
} finally {
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (userId && projectId) {
    await rm(resolve(repositoryRoot, "data", "owners", userId, "projects", projectId), {
      recursive: true,
      force: true,
    });
  }
  if (analysisId) {
    await rm(resolve(repositoryRoot, "data", "analyses", analysisId), {
      recursive: true,
      force: true,
    });
  }
}
