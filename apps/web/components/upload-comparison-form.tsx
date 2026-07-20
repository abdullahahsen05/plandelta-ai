"use client";

import { FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { apiRequest, apiRequestEmpty, PlanDeltaApiError } from "../lib/api/client";
import { analysisSchema, projectSchema, revisionSchema } from "../lib/api/contracts";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

const maximumBytes = 20 * 1024 * 1024;
const acceptedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

type ProgressStage = "idle" | "project" | "revisions" | "analysis";
type AnalysisProfile = "CONSTRUCTION_DRAWING" | "ENGINEERING_SCHEMATIC";

function FileField({
  eyebrow,
  label,
  file,
  disabled,
  onChange,
}: {
  eyebrow: string;
  label: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const id = useId();
  return (
    <div className="upload-field">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{label}</h2>
      </div>
      <label htmlFor={id}>
        <FileUp aria-hidden="true" size={24} strokeWidth={1.5} />
        <span>{file?.name ?? "Choose a drawing"}</span>
        <small>
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected`
            : "PDF, PNG, JPG or JPEG · up to 20 MB"}
        </small>
        <input
          accept="application/pdf,image/png,image/jpeg"
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>
    </div>
  );
}

function validateFile(file: File, label: string) {
  if (!acceptedTypes.has(file.type)) return `${label} must be a PDF, PNG, JPG or JPEG.`;
  if (file.size > maximumBytes) return `${label} exceeds the 20 MB upload limit.`;
  if (file.size === 0) return `${label} is empty.`;
  return null;
}

async function uploadRevision(
  token: string,
  projectId: string,
  file: File,
  role: "BASELINE" | "CANDIDATE",
) {
  const form = new FormData();
  form.set("file", file);
  form.set("label", role === "BASELINE" ? "Earlier revision" : "Later revision");
  form.set("role", role);
  form.set("selectedPage", "1");
  return apiRequest(`/projects/${projectId}/revisions`, token, revisionSchema, {
    method: "POST",
    body: form,
  });
}

export function UploadComparisonForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [analysisProfile, setAnalysisProfile] = useState<AnalysisProfile>("CONSTRUCTION_DRAWING");
  const [baseline, setBaseline] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [stage, setStage] = useState<ProgressStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = stage !== "idle";
  const ready = name.trim().length > 0 && baseline && candidate && !busy;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!baseline || !candidate || !name.trim()) return;
    const fileError = validateFile(baseline, "Baseline") ?? validateFile(candidate, "Candidate");
    if (fileError) {
      setError(fileError);
      return;
    }

    setError(null);
    let projectId: string | null = null;
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.push(`/auth/sign-in?next=${encodeURIComponent("/app/projects/new")}`);
        return;
      }

      setStage("project");
      const project = await apiRequest("/projects", token, projectSchema, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          projectCode: projectCode.trim() || undefined,
          analysisProfile,
          description:
            analysisProfile === "ENGINEERING_SCHEMATIC"
              ? "Engineering schematic revision comparison created in the PlanDelta workspace."
              : "Blueprint revision comparison created in the PlanDelta workspace.",
        }),
      });
      projectId = project.id;

      setStage("revisions");
      const [baselineRevision, candidateRevision] = await Promise.all([
        uploadRevision(token, project.id, baseline, "BASELINE"),
        uploadRevision(token, project.id, candidate, "CANDIDATE"),
      ]);

      setStage("analysis");
      const analysis = await apiRequest(`/projects/${project.id}/analyses`, token, analysisSchema, {
        method: "POST",
        body: JSON.stringify({
          baselineRevisionId: baselineRevision.id,
          candidateRevisionId: candidateRevision.id,
          configuration: {
            page: 1,
            sensitivity: "balanced",
            ocrEnabled: true,
            classifier: "auto",
          },
        }),
      });
      router.push(`/app/analyses/${analysis.id}`);
    } catch (reason) {
      const message =
        reason instanceof PlanDeltaApiError
          ? reason.message
          : reason instanceof Error && reason.message.startsWith("Missing required public")
            ? "The application is missing required public configuration."
            : "The comparison could not be started. Check the files and try again.";
      setError(message);
      if (projectId) {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          await apiRequestEmpty(`/projects/${projectId}`, data.session.access_token, {
            method: "DELETE",
          }).catch(() => undefined);
        }
      }
      setStage("idle");
    }
  }

  const progress = {
    idle: ready ? "Ready to analyze" : "Complete all fields",
    project: "Creating secure project…",
    revisions: "Uploading both revisions…",
    analysis: "Queueing analysis…",
  }[stage];

  return (
    <form onSubmit={submit}>
      <div className="comparison-metadata">
        <label>
          <span>Project name</span>
          <input
            autoComplete="off"
            disabled={busy}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            placeholder="Riverside Medical Pavilion"
            required
            value={name}
          />
        </label>
        <label>
          <span>
            Project code <small>optional</small>
          </span>
          <input
            autoComplete="off"
            disabled={busy}
            maxLength={64}
            onChange={(event) => setProjectCode(event.target.value)}
            placeholder="RMP-024"
            value={projectCode}
          />
        </label>
        <fieldset className="profile-selector" disabled={busy}>
          <legend>Analysis profile</legend>
          <label>
            <input
              checked={analysisProfile === "CONSTRUCTION_DRAWING"}
              name="analysis-profile"
              onChange={() => setAnalysisProfile("CONSTRUCTION_DRAWING")}
              type="radio"
            />
            <span>
              <strong>Construction drawing</strong>
              <small>Walls, openings, fixtures, dimensions, labels, and notes</small>
            </span>
          </label>
          <label>
            <input
              checked={analysisProfile === "ENGINEERING_SCHEMATIC"}
              name="analysis-profile"
              onChange={() => setAnalysisProfile("ENGINEERING_SCHEMATIC")}
              type="radio"
            />
            <span>
              <strong>Engineering schematic</strong>
              <small>Components, connections, labels, notes, and dimensions</small>
            </span>
          </label>
        </fieldset>
      </div>
      <div className="upload-grid">
        <FileField
          disabled={busy}
          eyebrow="Baseline"
          file={baseline}
          label="Earlier revision"
          onChange={setBaseline}
        />
        <FileField
          disabled={busy}
          eyebrow="Candidate"
          file={candidate}
          label="Later revision"
          onChange={setCandidate}
        />
      </div>
      <div className="submission-bar">
        <div className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[#17845B]" size={20} />
          <div>
            <p className="font-semibold">Private project evidence</p>
            <p>
              Files are validated, stored outside the web app, and only available to your account.
            </p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <button disabled={!ready} type="submit">
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : null}
          {progress}
        </button>
      </div>
    </form>
  );
}
