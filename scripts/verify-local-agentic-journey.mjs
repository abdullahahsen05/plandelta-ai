import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";

const repositoryRoot = resolve(import.meta.dirname, "..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length > 0) {
  throw new Error(`Missing required variables: ${missingVariables.join(", ")}`);
}

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000").replace(
  /\/$/,
  "",
);
const apiUrl = configuredApiUrl.endsWith("/v1") ? configuredApiUrl : `${configuredApiUrl}/v1`;
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const browser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const suffix = randomUUID();
const email = `plandelta-agentic-e2e-${suffix}@example.invalid`;
const password = `Local-${randomUUID()}-9a!`;
let userId;
let projectId;
let documentId;
let accessToken;

const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

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
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed (${response.status}): ${body?.error?.code ?? "UNKNOWN"}`,
    );
  }
  return body;
}

async function verify() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error("Synthetic user creation failed.");
  }
  userId = created.data.user.id;

  const signedIn = await browser.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw signedIn.error ?? new Error("Synthetic sign-in failed.");
  }
  accessToken = signedIn.data.session.access_token;

  const project = await api("/projects", accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Agentic RAG release journey",
      projectCode: "RAG-E2E",
      analysisProfile: "ENGINEERING_SCHEMATIC",
    }),
  });
  projectId = project.id;

  const bytes = await readFile(
    resolve(repositoryRoot, "samples", "schematic", "control-loop-notes.txt"),
  );
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "text/plain" }), "control-loop-notes.txt");
  form.set("documentType", "TECHNICAL_NOTE");
  form.set("revisionLabel", "Rev B");
  const document = await api(`/projects/${projectId}/knowledge-documents`, accessToken, {
    method: "POST",
    body: form,
  });
  documentId = document.id;

  let indexedDocument;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    indexedDocument = await api(
      `/projects/${projectId}/knowledge-documents/${documentId}`,
      accessToken,
    );
    const status = indexedDocument.ingestionJobs?.[0]?.status;
    if (status === "COMPLETED" || status === "FAILED") break;
    await wait(1_000);
  }
  const ingestion = indexedDocument?.ingestionJobs?.[0];
  if (ingestion?.status !== "COMPLETED") {
    throw new Error(`Supporting-document ingestion ended as ${ingestion?.status ?? "timed-out"}.`);
  }

  const conversation = await api(`/projects/${projectId}/conversations`, accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "RFI evidence check" }),
  });
  const queued = await api(`/conversations/${conversation.id}/messages`, accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content:
        "Draft an RFI for the revised R3 control-loop evidence. Cite the supporting technical note and clearly require human review.",
      idempotencyKey: randomUUID(),
    }),
  });

  let run;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    run = await api(`/agent-runs/${queued.runId}`, accessToken);
    if (["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(run.status)) break;
    await wait(1_000);
  }
  if (run?.status !== "COMPLETED") {
    throw new Error(
      `Evidence run ended as ${run?.status ?? "timed-out"}: ${run?.failureCode ?? "none"}.`,
    );
  }

  const messages = await api(`/conversations/${conversation.id}/messages`, accessToken);
  const answer = messages.find((message) => message.role === "ASSISTANT");
  if (
    !answer?.rfiDraft ||
    !Array.isArray(answer.citations) ||
    answer.citations.length < 1 ||
    answer.citations.some((citation) => !citation.verifiedAt)
  ) {
    throw new Error(
      `The response failed the RFI/citation gate: draft=${Boolean(answer?.rfiDraft)}, citations=${answer?.citations?.length ?? 0}, status=${answer?.answerStatus ?? "missing"}, provider=${answer?.provider ?? "missing"}.`,
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      result: "passed",
      ingestion: ingestion.status,
      run: run.status,
      citations: answer.citations.length,
      rfiDraft: "review-only",
      provider: answer.provider,
      cleanup: "pending",
    })}\n`,
  );

  await api(`/projects/${projectId}/knowledge-documents/${documentId}`, accessToken, {
    method: "DELETE",
  });
  documentId = undefined;
}

try {
  await verify();
} finally {
  if (accessToken && projectId && documentId) {
    await api(`/projects/${projectId}/knowledge-documents/${documentId}`, accessToken, {
      method: "DELETE",
    }).catch(() => undefined);
  }
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
  if (userId) await admin.auth.admin.deleteUser(userId);
}

process.stdout.write(`${JSON.stringify({ cleanup: "passed" })}\n`);
