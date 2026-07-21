"use client";

import {
  AlignHorizontalSpaceAround,
  Download,
  Eye,
  Files,
  FileUp,
  Focus,
  Hand,
  Link2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  sampleChanges,
  sampleProject,
  schematicSampleChanges,
  schematicSampleProject,
} from "../lib/sample-data";
import type { SampleChange } from "../lib/sample-data";
import type { CompareMode } from "./blueprint-canvas";
import { ChangeLedger, type ChangeFilter } from "./change-ledger";
import { EvidenceCopilot } from "./evidence-copilot/evidence-copilot";
import { KnowledgeRegister } from "./knowledge-register";
import type { KnowledgeDocument } from "../lib/api/contracts";

const BlueprintCanvas = dynamic(
  () => import("./blueprint-canvas").then((module) => module.BlueprintCanvas),
  {
    ssr: false,
    loading: () => (
      <div aria-busy="true" className="blueprint-canvas-loading">
        <span className="loading-line w-44" />
        <p>Preparing drawing comparison…</p>
      </div>
    ),
  },
);

export type WorkbenchData = {
  sample: boolean;
  analysisId?: string | undefined;
  projectId: string;
  projectName: string;
  analysisProfile: "CONSTRUCTION_DRAWING" | "ENGINEERING_SCHEMATIC";
  profileLabel: string;
  comparisonLabel: string;
  sheet: string;
  sheetTitle: string;
  baseline: { label: string; revision: string; issuedAt: string };
  candidate: { label: string; revision: string; issuedAt: string };
  engine: string;
  alignment: string;
  reprojectionError: string;
  changes: SampleChange[];
  baselineImageUrl?: string | undefined;
  candidateImageUrl?: string | undefined;
  alignedCandidateImageUrl?: string | undefined;
  documentWidth?: number | undefined;
  documentHeight?: number | undefined;
  reportSummary?: string | undefined;
  summaryProvider?: "DETERMINISTIC" | "BEDROCK" | undefined;
  reportUrl?: string | undefined;
  knowledgeDocuments?: KnowledgeDocument[] | undefined;
};

const sampleWorkbench: WorkbenchData = {
  sample: true,
  analysisId: sampleProject.analysis.id,
  projectId: sampleProject.id,
  projectName: sampleProject.name,
  comparisonLabel: "A2.14 · Rev 03 → 04",
  sheet: sampleProject.baseline.sheet,
  sheetTitle: sampleProject.baseline.title,
  baseline: sampleProject.baseline,
  candidate: sampleProject.candidate,
  engine: sampleProject.analysis.engine,
  alignment: sampleProject.analysis.alignment,
  reprojectionError: sampleProject.analysis.reprojectionError,
  changes: sampleChanges,
  summaryProvider: "DETERMINISTIC",
  analysisProfile: sampleProject.analysisProfile,
  profileLabel: sampleProject.profileLabel,
  baselineImageUrl: "/samples/construction-baseline.png",
  candidateImageUrl: "/samples/construction-candidate.png",
  alignedCandidateImageUrl: "/samples/construction-candidate.png",
  documentWidth: 800,
  documentHeight: 600,
};

export const schematicSampleWorkbench: WorkbenchData = {
  sample: true,
  analysisId: schematicSampleProject.analysis.id,
  projectId: schematicSampleProject.id,
  projectName: schematicSampleProject.name,
  analysisProfile: schematicSampleProject.analysisProfile,
  profileLabel: schematicSampleProject.profileLabel,
  comparisonLabel: "S-101 · Rev A → B",
  sheet: schematicSampleProject.baseline.sheet,
  sheetTitle: schematicSampleProject.baseline.title,
  baseline: schematicSampleProject.baseline,
  candidate: schematicSampleProject.candidate,
  engine: schematicSampleProject.analysis.engine,
  alignment: schematicSampleProject.analysis.alignment,
  reprojectionError: schematicSampleProject.analysis.reprojectionError,
  changes: schematicSampleChanges,
  baselineImageUrl: "/samples/schematic-baseline.png",
  candidateImageUrl: "/samples/schematic-candidate.png",
  alignedCandidateImageUrl: "/samples/schematic-candidate.png",
  documentWidth: 800,
  documentHeight: 600,
  summaryProvider: "DETERMINISTIC",
};

function RevisionRail({ data }: { data: WorkbenchData }) {
  return (
    <aside aria-label="Revision rail" className="revision-rail">
      <div className="revision-rail-heading">
        <p className="eyebrow">SOURCE REVISIONS BEING COMPARED</p>
        <h2>Before and revised</h2>
        <p>
          {data.sheet} · {data.sheetTitle}
        </p>
      </div>
      {[data.baseline, data.candidate].map((revision, index) => (
        <article className="rail-revision" key={revision.label}>
          <div
            aria-hidden="true"
            className={index === 1 ? "rail-revision-key candidate" : "rail-revision-key"}
          >
            {index === 0 ? "A" : "B"}
          </div>
          <div>
            <span className="eyebrow">
              {index === 0 ? "BEFORE · BASELINE" : "REVISED · CANDIDATE"}
            </span>
            <h3>{revision.revision}</h3>
            <p>Issued {revision.issuedAt}</p>
          </div>
        </article>
      ))}
      <p className="revision-explainer">
        PlanDelta compares revision B against revision A using the {data.profileLabel.toLowerCase()}{" "}
        profile. Change markers appear on the revised source.
      </p>
      <dl className="alignment-data">
        <div>
          <dt>Drawing alignment</dt>
          <dd>
            <span className="status-dot" /> {data.alignment}
          </dd>
        </div>
        <div>
          <dt>Alignment error</dt>
          <dd>{data.reprojectionError}</dd>
        </div>
        <div>
          <dt>Page pair</dt>
          <dd>01 / 01</dd>
        </div>
      </dl>
      <p className="rail-note">
        {data.sample
          ? "Built-in example using committed sample drawings. It is not client data."
          : "Result from your uploaded drawings. Verify each marked area before coordinating work."}
      </p>
    </aside>
  );
}

function modeDescription(mode: CompareMode) {
  if (mode === "split") {
    return "Original drawings are shown next to each other. The revised drawing carries the change markers.";
  }
  if (mode === "overlay") {
    return "The aligned revised drawing is placed over the baseline. Adjust opacity to inspect the difference.";
  }
  if (mode === "swipe") {
    return "Move the divider to reveal the aligned revised drawing over the baseline.";
  }
  if (mode === "baseline") return "Only the earlier baseline drawing is shown.";
  if (mode === "candidate") return "Only the revised drawing is shown.";
  return "The aligned baseline and revised drawing alternate automatically.";
}

function ProjectEvidenceDrawer({
  documents,
  focus,
  onClose,
  onDocumentsChange,
  projectId,
}: {
  documents: KnowledgeDocument[];
  focus: "upload" | "review";
  onClose: () => void;
  onDocumentsChange: (documents: KnowledgeDocument[]) => void;
  projectId: string;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="evidence-drawer-backdrop" onMouseDown={onClose} role="presentation">
      <aside
        aria-label="Project evidence"
        aria-modal="true"
        className="evidence-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="evidence-drawer-header">
          <div>
            <p className="eyebrow">PROJECT-SCOPED RAG EVIDENCE</p>
            <h2>{focus === "upload" ? "Upload evidence" : "Review project documents"}</h2>
            <p>
              Evidence Copilot retrieves only ready, authorized documents shown in this register.
            </p>
          </div>
          <button aria-label="Close project evidence" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="evidence-drawer-body">
          <KnowledgeRegister
            initialDocuments={documents}
            onDocumentsChange={onDocumentsChange}
            projectId={projectId}
          />
        </div>
      </aside>
    </div>
  );
}

type LargeDrawingView = "split" | "baseline" | "candidate";

function DrawingLightbox({
  data,
  mode,
  selectedId,
  onClose,
  onModeChange,
  onSelect,
}: {
  data: WorkbenchData;
  mode: LargeDrawingView;
  selectedId: string;
  onClose: () => void;
  onModeChange: (mode: LargeDrawingView) => void;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [fitToken, setFitToken] = useState(0);
  const selectedChange = data.changes.find((change) => change.id === selectedId);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const fit = () => {
    setZoom(1);
    setFitToken((value) => value + 1);
  };

  return (
    <div
      aria-label="Large drawing comparison"
      aria-modal="true"
      className="drawing-lightbox"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <section className="drawing-lightbox-panel">
        <header className="drawing-lightbox-header">
          <div>
            <p className="eyebrow">FULL-SHEET REVIEW</p>
            <h2>Inspect the source drawings</h2>
            <p>
              Revised markers are numbered to match the change list. Scroll to zoom and drag to pan.
            </p>
          </div>
          <button autoFocus className="drawing-lightbox-close" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} /> Close
          </button>
        </header>

        <div className="drawing-lightbox-toolbar">
          <div aria-label="Large drawing view" className="drawing-lightbox-views" role="group">
            <button
              aria-pressed={mode === "split"}
              onClick={() => onModeChange("split")}
              type="button"
            >
              Side by side
            </button>
            <button
              aria-pressed={mode === "baseline"}
              onClick={() => onModeChange("baseline")}
              type="button"
            >
              Before
            </button>
            <button
              aria-pressed={mode === "candidate"}
              onClick={() => onModeChange("candidate")}
              type="button"
            >
              Revised + labels
            </button>
          </div>
          <div className="drawing-lightbox-zoom" role="group" aria-label="Large drawing zoom">
            <button
              aria-label="Zoom out large drawing"
              onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}
              type="button"
            >
              <Minus aria-hidden="true" size={15} />
            </button>
            <span className="technical">{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Zoom in large drawing"
              onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}
              type="button"
            >
              <Plus aria-hidden="true" size={15} />
            </button>
            <button onClick={fit} type="button">
              <Maximize2 aria-hidden="true" size={15} /> Fit
            </button>
          </div>
        </div>

        <div className="drawing-lightbox-canvas">
          <BlueprintCanvas
            alignedCandidateImageUrl={data.alignedCandidateImageUrl}
            baselineImageUrl={data.baselineImageUrl}
            candidateImageUrl={data.candidateImageUrl}
            changes={data.changes}
            documentHeight={data.documentHeight}
            documentWidth={data.documentWidth}
            fitToken={fitToken}
            mode={mode}
            onSelect={onSelect}
            onZoomChange={setZoom}
            opacity={100}
            selectedId={selectedId}
            swipe={50}
            zoom={zoom}
          />
        </div>

        <footer className="drawing-lightbox-footer">
          <span>
            {mode === "baseline"
              ? "BEFORE · SOURCE DRAWING"
              : mode === "candidate"
                ? "REVISED · NUMBERED FINDINGS"
                : "BEFORE + REVISED · LINKED REVIEW"}
          </span>
          <span>
            {selectedChange && mode !== "baseline"
              ? `${String(selectedChange.sequence).padStart(2, "0")} · ${selectedChange.title}`
              : `${data.changes.length} evidence regions · select a marker to update the ledger`}
          </span>
        </footer>
      </section>
    </div>
  );
}

export function Workbench({ data = sampleWorkbench }: { data?: WorkbenchData }) {
  const [selectedId, setSelectedId] = useState(data.changes[0]?.id ?? "");
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [mode, setMode] = useState<CompareMode>("split");
  const [opacity, setOpacity] = useState(72);
  const [swipe, setSwipe] = useState(58);
  const [zoom, setZoom] = useState(1);
  const [fitToken, setFitToken] = useState(0);
  const [synchronized, setSynchronized] = useState(true);
  const [largeView, setLargeView] = useState<LargeDrawingView | null>(null);
  const [evidenceDrawer, setEvidenceDrawer] = useState<"upload" | "review" | null>(null);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState(data.knowledgeDocuments ?? []);

  const selectChange = (id: string) => {
    setSelectedId(id);
    setZoom((current) => Math.max(current, 1.15));
  };

  const fit = () => {
    setZoom(1);
    setFitToken((current) => current + 1);
  };

  return (
    <main className="workbench-shell">
      <div className="workbench-toolbar">
        <div className="workbench-crumbs">
          <Link href={`/app/projects/${data.projectId}`}>{data.projectName}</Link>
          <span>/</span>
          <strong>{data.comparisonLabel}</strong>
          <span className={data.sample ? "sample-flag" : "live-flag"}>
            {data.sample ? "PRECOMPUTED SAMPLE" : "LIVE ANALYSIS"}
          </span>
          <span className="profile-flag">{data.profileLabel}</span>
        </div>
        <div className="analysis-state">
          <span className="status-dot" />
          <span>Analysis complete</span>
          <span className="technical">{data.engine}</span>
        </div>
        {data.reportUrl ? (
          <a
            className="export-button active"
            href={data.reportUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Download aria-hidden="true" size={15} /> Print report
          </a>
        ) : data.sample ? (
          <Link className="export-button active" href="/app/projects/new">
            <RotateCcw aria-hidden="true" size={15} /> Run fresh analysis
          </Link>
        ) : (
          <button className="export-button" disabled type="button">
            <Download aria-hidden="true" size={15} /> Report unavailable
          </button>
        )}
      </div>

      <div className="workbench-controls" aria-label="Drawing comparison controls">
        <div className="control-group">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}
            type="button"
          >
            <Minus aria-hidden="true" size={15} />
          </button>
          <span className="technical zoom-value">{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
          </button>
          <button onClick={fit} type="button">
            <Maximize2 aria-hidden="true" size={15} /> Fit
          </button>
          <button aria-pressed="true" type="button">
            <Hand aria-hidden="true" size={15} /> Pan
          </button>
        </div>

        <div aria-label="Comparison view" className="comparison-view-switcher" role="group">
          <button aria-pressed={mode === "split"} onClick={() => setMode("split")} type="button">
            Side by side
          </button>
          <button
            aria-pressed={mode === "overlay"}
            onClick={() => setMode("overlay")}
            type="button"
          >
            Overlay
          </button>
          <button aria-pressed={mode === "swipe"} onClick={() => setMode("swipe")} type="button">
            Swipe
          </button>
        </div>

        <div className="control-group comparison-mode">
          <Eye aria-hidden="true" size={15} />
          <label htmlFor="compare-mode">More views</label>
          <select
            id="compare-mode"
            onChange={(event) => setMode(event.target.value as CompareMode)}
            value={["blink", "baseline", "candidate"].includes(mode) ? mode : ""}
          >
            <option disabled value="">
              Select
            </option>
            <option value="blink">Blink comparison</option>
            <option value="baseline">Baseline only</option>
            <option value="candidate">Revised only</option>
          </select>
        </div>

        {!data.sample ? (
          <div
            aria-label="Project evidence controls"
            className="evidence-toolbar-actions"
            role="group"
          >
            <button onClick={() => setEvidenceDrawer("upload")} type="button">
              <FileUp aria-hidden="true" size={15} /> Upload evidence
            </button>
            <button onClick={() => setEvidenceDrawer("review")} type="button">
              <Files aria-hidden="true" size={15} /> Review documents
              <span className="technical">{knowledgeDocuments.length}</span>
            </button>
          </div>
        ) : null}

        {mode === "overlay" ? (
          <div className="control-group range-control">
            <label htmlFor="overlay-opacity">Revised opacity</label>
            <input
              id="overlay-opacity"
              max="100"
              min="20"
              onChange={(event) => setOpacity(Number(event.target.value))}
              type="range"
              value={opacity}
            />
            <span className="technical">{opacity}%</span>
          </div>
        ) : null}

        {mode === "swipe" ? (
          <div className="control-group range-control">
            <AlignHorizontalSpaceAround aria-hidden="true" size={15} />
            <label htmlFor="swipe-position">Divider</label>
            <input
              id="swipe-position"
              max="90"
              min="10"
              onChange={(event) => setSwipe(Number(event.target.value))}
              type="range"
              value={swipe}
            />
          </div>
        ) : null}

        <button
          aria-pressed={synchronized}
          className="sync-control"
          onClick={() => setSynchronized((value) => !value)}
          type="button"
        >
          <Link2 aria-hidden="true" size={15} />{" "}
          {synchronized ? "Pan and zoom linked" : "Pan and zoom unlinked"}
        </button>
      </div>

      <div className="comparison-guidance" role="status">
        <strong>{mode === "split" ? "Start here: compare left and right" : `${mode} view`}</strong>
        <span>{modeDescription(mode)}</span>
      </div>

      <div className="workbench-grid">
        <RevisionRail data={data} />
        <section className="canvas-panel" aria-label="Drawing comparison viewport">
          <BlueprintCanvas
            alignedCandidateImageUrl={data.alignedCandidateImageUrl}
            baselineImageUrl={data.baselineImageUrl}
            candidateImageUrl={data.candidateImageUrl}
            changes={data.changes}
            documentHeight={data.documentHeight}
            documentWidth={data.documentWidth}
            fitToken={fitToken}
            mode={mode}
            onSelect={selectChange}
            onOpenLarge={setLargeView}
            onZoomChange={setZoom}
            opacity={opacity}
            selectedId={selectedId}
            swipe={swipe}
            zoom={zoom}
          />
          <div className="canvas-statusbar">
            <span>
              <Focus aria-hidden="true" size={13} /> Markers are shown on the revised drawing
            </span>
            <span>
              <b className="font-semibold text-[#40433F]">
                {data.summaryProvider === "BEDROCK"
                  ? "AI-generated via Amazon Bedrock"
                  : "Deterministic evidence"}
              </b>
              {data.reportSummary ?? "Select a change marker or list item to review its evidence."}
            </span>
          </div>
        </section>
        <ChangeLedger
          changes={data.changes}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={selectChange}
          selectedId={selectedId}
        />
        <EvidenceCopilot
          analysisId={data.analysisId}
          changes={data.changes}
          onSelectChange={selectChange}
          projectId={data.projectId}
          profile={data.analysisProfile}
          sample={data.sample}
        />
      </div>
      {largeView ? (
        <DrawingLightbox
          data={data}
          mode={largeView}
          onClose={() => setLargeView(null)}
          onModeChange={setLargeView}
          onSelect={selectChange}
          selectedId={selectedId}
        />
      ) : null}
      {evidenceDrawer ? (
        <ProjectEvidenceDrawer
          documents={knowledgeDocuments}
          focus={evidenceDrawer}
          onClose={() => setEvidenceDrawer(null)}
          onDocumentsChange={setKnowledgeDocuments}
          projectId={data.projectId}
        />
      ) : null}
    </main>
  );
}
