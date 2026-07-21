"use client";

import {
  AlertTriangle,
  Check,
  FileText,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  SquareArrowOutUpRight,
  Trash2,
  Upload,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { apiRequest, apiRequestEmpty, PlanDeltaApiError } from "../lib/api/client";
import {
  type KnowledgeDocument,
  knowledgeDocumentListSchema,
  knowledgeDocumentSchema,
} from "../lib/api/contracts";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

const documentTypes = [
  ["SPECIFICATION", "Specification"],
  ["DRAWING_NOTES", "Drawing notes"],
  ["REVISION_NARRATIVE", "Revision narrative"],
  ["ADDENDUM", "Addendum"],
  ["BOQ_SCHEDULE", "BOQ / schedule"],
  ["RFI", "RFI"],
  ["PRIOR_REPORT", "Prior report"],
  ["TECHNICAL_NOTE", "Technical note"],
] as const;

const activeJobStatuses = new Set([
  "QUEUED",
  "CLAIMED",
  "EXTRACTING",
  "CHUNKING",
  "EMBEDDING",
  "RETRYING",
]);

function friendlyStatus(document: KnowledgeDocument) {
  const status = document.ingestionJobs[0]?.status ?? document.status;
  return status.toLowerCase().replaceAll("_", " ");
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function actionError(error: unknown) {
  if (error instanceof PlanDeltaApiError) return error.message;
  return "The request could not be completed. Check the file and try again.";
}

export function KnowledgeRegister({
  initialDocuments,
  projectId,
  onDocumentsChange,
}: {
  initialDocuments: KnowledgeDocument[];
  projectId: string;
  onDocumentsChange?: (documents: KnowledgeDocument[]) => void;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const supabaseRef = useRef(createBrowserSupabaseClient());

  useEffect(() => {
    onDocumentsChange?.(documents);
  }, [documents, onDocumentsChange]);

  const accessToken = useCallback(async () => {
    const { data } = await supabaseRef.current.auth.getSession();
    if (!data.session?.access_token) throw new Error("Your guest session has expired. Reopen the workspace.");
    return data.session.access_token;
  }, []);

  const refresh = useCallback(
    async (announce = false) => {
      const token = await accessToken();
      const next = await apiRequest(
        `/projects/${projectId}/knowledge-documents`,
        token,
        knowledgeDocumentListSchema,
      );
      setDocuments(next);
      if (announce) setNotice("Ingestion status refreshed.");
    },
    [accessToken, projectId],
  );

  useEffect(() => {
    if (
      !documents.some((document) => activeJobStatuses.has(document.ingestionJobs[0]?.status ?? ""))
    )
      return;
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 3000);
    return () => window.clearInterval(timer);
  }, [documents, refresh]);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a PDF or TXT supporting document.");
      return;
    }
    const form = event.currentTarget;
    const body = new FormData(form);
    setBusyAction("upload");
    setError(null);
    setNotice(null);
    try {
      const token = await accessToken();
      const created = await apiRequest(
        `/projects/${projectId}/knowledge-documents`,
        token,
        knowledgeDocumentSchema,
        { method: "POST", body },
      );
      setDocuments((current) => [created, ...current]);
      setSelectedFile(null);
      form.reset();
      setNotice(`${created.originalName} was validated and queued for ingestion.`);
    } catch (caught) {
      setError(actionError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function replaceVersion(document: KnowledgeDocument, file: File) {
    const body = new FormData();
    body.set("file", file);
    body.set("documentType", document.documentType);
    if (document.activeVersion?.revisionLabel)
      body.set("revisionLabel", document.activeVersion.revisionLabel);
    if (document.activeVersion?.effectiveDate)
      body.set("effectiveDate", document.activeVersion.effectiveDate.slice(0, 10));
    setBusyAction(`version:${document.id}`);
    setError(null);
    setNotice(null);
    try {
      const token = await accessToken();
      const updated = await apiRequest(
        `/projects/${projectId}/knowledge-documents/${document.id}/versions`,
        token,
        knowledgeDocumentSchema,
        { method: "POST", body },
      );
      setDocuments((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setNotice(`A new version of ${updated.originalName} was queued.`);
    } catch (caught) {
      setError(actionError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function retry(document: KnowledgeDocument) {
    setBusyAction(`retry:${document.id}`);
    setError(null);
    setNotice(null);
    try {
      const token = await accessToken();
      const updated = await apiRequest(
        `/projects/${projectId}/knowledge-documents/${document.id}/retry`,
        token,
        knowledgeDocumentSchema,
        { method: "POST" },
      );
      setDocuments((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setNotice(`${document.originalName} was queued for another attempt.`);
    } catch (caught) {
      setError(actionError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function remove(document: KnowledgeDocument) {
    if (!window.confirm(`Delete ${document.originalName} and its indexed evidence?`)) return;
    setBusyAction(`delete:${document.id}`);
    setError(null);
    setNotice(null);
    try {
      const token = await accessToken();
      await apiRequestEmpty(`/projects/${projectId}/knowledge-documents/${document.id}`, token, {
        method: "DELETE",
      });
      setDocuments((current) => current.filter((entry) => entry.id !== document.id));
      setNotice(`${document.originalName} and its indexed evidence were deleted.`);
    } catch (caught) {
      setError(actionError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="knowledge-register" aria-labelledby="knowledge-heading">
      <div className="section-heading knowledge-heading">
        <div>
          <p className="eyebrow">EVIDENCE LIBRARY</p>
          <h2 id="knowledge-heading">Supporting documents</h2>
          <p>
            Add project specifications, notes, and revision records. PlanDelta searches only ready
            evidence from this project.
          </p>
        </div>
        <button
          className="knowledge-refresh"
          disabled={busyAction !== null}
          onClick={() => {
            setBusyAction("refresh");
            setError(null);
            void refresh(true)
              .catch((caught: unknown) => setError(actionError(caught)))
              .finally(() => setBusyAction(null));
          }}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={15} />
          Refresh
        </button>
      </div>

      <form className="knowledge-upload" onSubmit={uploadDocument} ref={formRef}>
        <label className="knowledge-file">
          <span>Document</span>
          <input
            accept=".pdf,.txt,application/pdf,text/plain"
            disabled={busyAction !== null}
            name="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            required
            type="file"
          />
          <strong>
            <Upload aria-hidden="true" size={16} />
            {selectedFile?.name ?? "Choose PDF or TXT"}
          </strong>
          <small>Maximum 20 MB and 100 PDF pages</small>
        </label>
        <label>
          <span>Evidence type</span>
          <select defaultValue="SPECIFICATION" disabled={busyAction !== null} name="documentType">
            {documentTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Revision label <small>optional</small>
          </span>
          <input disabled={busyAction !== null} maxLength={120} name="revisionLabel" />
        </label>
        <label>
          <span>
            Effective date <small>optional</small>
          </span>
          <input disabled={busyAction !== null} name="effectiveDate" type="date" />
        </label>
        <button className="knowledge-submit" disabled={busyAction !== null} type="submit">
          {busyAction === "upload" ? (
            <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" size={16} />
          ) : (
            <Upload aria-hidden="true" size={16} />
          )}
          Validate and ingest
        </button>
      </form>

      <div aria-atomic="true" aria-live="polite">
        {error ? (
          <p className="knowledge-message knowledge-message-error" role="alert">
            <AlertTriangle aria-hidden="true" size={16} /> {error}
          </p>
        ) : null}
        {notice ? (
          <p className="knowledge-message">
            <Check aria-hidden="true" size={16} /> {notice}
          </p>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <div className="knowledge-empty">
          <FileText aria-hidden="true" size={22} />
          <div>
            <h3>No supporting evidence yet</h3>
            <p>Upload a specification or project note to make it available to Evidence Copilot.</p>
          </div>
        </div>
      ) : (
        <div className="knowledge-list">
          <div className="knowledge-list-header" aria-hidden="true">
            <span>Document</span>
            <span>Revision</span>
            <span>Ingestion</span>
            <span>Actions</span>
          </div>
          {documents.map((document) => {
            const job = document.ingestionJobs[0];
            const status = job?.status ?? document.status;
            const isActive = activeJobStatuses.has(status);
            const failed = status === "FAILED" || status === "CANCELLED";
            const progress =
              status === "COMPLETED" || document.status === "READY" ? 100 : (job?.progress ?? 0);
            const itemBusy = busyAction?.endsWith(document.id) ?? false;
            return (
              <article className="knowledge-row" key={document.id}>
                <div className="knowledge-document">
                  <FileText aria-hidden="true" size={18} />
                  <div>
                    <h3>{document.originalName}</h3>
                    <p>
                      {documentTypes.find(([value]) => value === document.documentType)?.[1]}
                      {" · "}
                      {formatBytes(document.byteSize)}
                      {document.activeVersion?.pageCount
                        ? ` · ${document.activeVersion.pageCount} pages`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="knowledge-revision">
                  <strong>{document.activeVersion?.revisionLabel ?? "Unlabelled"}</strong>
                  <span>
                    {document.activeVersion?.effectiveDate
                      ? new Date(document.activeVersion.effectiveDate).toLocaleDateString()
                      : "No effective date"}
                  </span>
                </div>
                <div className="knowledge-state">
                  <div>
                    <span
                      className={`knowledge-state-mark ${
                        failed
                          ? "knowledge-state-error"
                          : document.status === "READY"
                            ? "knowledge-state-ready"
                            : ""
                      }`}
                    />
                    <strong>{friendlyStatus(document)}</strong>
                    <span>{progress}%</span>
                  </div>
                  <div
                    aria-label={`${friendlyStatus(document)}, ${progress}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={progress}
                    className="knowledge-progress"
                    role="progressbar"
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  {failed ? (
                    <small>
                      Code: {job?.failureCode ?? document.failureCode ?? "INGESTION_FAILED"}
                    </small>
                  ) : isActive ? (
                    <small>
                      {job?.currentStage ?? "queued"} · attempt {(job?.attemptCount ?? 0) + 1}
                    </small>
                  ) : null}
                </div>
                <div className="knowledge-actions">
                  <a
                    href={`/api/projects/${projectId}/knowledge-documents/${document.id}/source`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <SquareArrowOutUpRight aria-hidden="true" size={14} /> Review source
                  </a>
                  {failed ? (
                    <button disabled={itemBusy} onClick={() => void retry(document)} type="button">
                      <RotateCcw aria-hidden="true" size={14} /> Retry
                    </button>
                  ) : null}
                  <label className={itemBusy || isActive ? "is-disabled" : ""}>
                    <Upload aria-hidden="true" size={14} /> New version
                    <input
                      accept=".pdf,.txt,application/pdf,text/plain"
                      disabled={itemBusy || isActive}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void replaceVersion(document, file);
                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>
                  <button
                    aria-label={`Delete ${document.originalName}`}
                    disabled={itemBusy}
                    onClick={() => void remove(document)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={14} /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
