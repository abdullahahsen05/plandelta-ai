"use client";

import {
  AlignHorizontalSpaceAround,
  Download,
  Eye,
  Focus,
  Hand,
  Link2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { sampleChanges, sampleProject } from "../lib/sample-data";
import type { SampleChange } from "../lib/sample-data";
import type { CompareMode } from "./blueprint-canvas";
import { ChangeLedger, type ChangeFilter } from "./change-ledger";

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
  projectId: string;
  projectName: string;
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
  reportUrl?: string | undefined;
};

const sampleWorkbench: WorkbenchData = {
  sample: true,
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
};

function RevisionRail({ data }: { data: WorkbenchData }) {
  return (
    <aside aria-label="Revision rail" className="revision-rail">
      <div className="revision-rail-heading">
        <p className="eyebrow">DRAWINGS BEING COMPARED</p>
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
        PlanDelta compares drawing B against drawing A. Change markers appear on the revised
        drawing.
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

export function Workbench({ data = sampleWorkbench }: { data?: WorkbenchData }) {
  const [selectedId, setSelectedId] = useState(data.changes[0]?.id ?? "");
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [mode, setMode] = useState<CompareMode>("split");
  const [opacity, setOpacity] = useState(72);
  const [swipe, setSwipe] = useState(58);
  const [zoom, setZoom] = useState(1);
  const [fitToken, setFitToken] = useState(0);
  const [synchronized, setSynchronized] = useState(true);

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
      </div>
    </main>
  );
}
