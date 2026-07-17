"use client";

import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type RevisionFile = { name: string; size: number } | null;

function FileField({
  label,
  eyebrow,
  value,
  onChange,
}: {
  label: string;
  eyebrow: string;
  value: RevisionFile;
  onChange: (file: RevisionFile) => void;
}) {
  const inputId = `revision-${eyebrow.toLowerCase()}`;

  return (
    <div className="upload-field">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{label}</h2>
      </div>
      <label htmlFor={inputId}>
        <FileUp aria-hidden="true" size={24} strokeWidth={1.5} />
        <span>{value ? value.name : "Choose a drawing"}</span>
        <small>
          {value
            ? `${(value.size / 1024 / 1024).toFixed(1)} MB selected`
            : "PDF, PNG, JPG or JPEG · one page"}
        </small>
        <input
          accept="application/pdf,image/png,image/jpeg"
          id={inputId}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>
    </div>
  );
}

export default function NewProjectPage() {
  const [baseline, setBaseline] = useState<RevisionFile>(null);
  const [candidate, setCandidate] = useState<RevisionFile>(null);
  const ready = Boolean(baseline && candidate);

  return (
    <main className="app-page app-page-narrow">
      <Link className="back-link" href="/app">
        <ArrowLeft aria-hidden="true" size={16} /> Projects
      </Link>
      <div className="app-page-heading">
        <div>
          <p className="eyebrow">NEW COMPARISON</p>
          <h1>Select two revisions</h1>
          <p>Use matching sheets and choose one page from each drawing for the MVP review.</p>
        </div>
      </div>

      <div className="upload-grid">
        <FileField
          eyebrow="Baseline"
          label="Earlier revision"
          onChange={setBaseline}
          value={baseline}
        />
        <FileField
          eyebrow="Candidate"
          label="Later revision"
          onChange={setCandidate}
          value={candidate}
        />
      </div>

      <div className="submission-bar">
        <div className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[#17845B]" size={20} />
          <div>
            <p className="font-semibold">Local selection only</p>
            <p>
              Files are not uploaded from this Phase 1 shell. Submission activates with the secured
              storage and analysis workflow.
            </p>
          </div>
        </div>
        <button disabled type="button">
          {ready ? "Ready for upload wiring" : "Select both revisions"}
        </button>
      </div>
    </main>
  );
}
