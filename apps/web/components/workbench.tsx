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
import { ChangeLedger, type ChangeFilter } from "./change-ledger";
import type { CompareMode } from "./blueprint-canvas";

const BlueprintCanvas = dynamic(
  () => import("./blueprint-canvas").then((module) => module.BlueprintCanvas),
  {
    ssr: false,
    loading: () => (
      <div aria-busy="true" className="blueprint-canvas-loading">
        <span className="loading-line w-44" />
        <p>Preparing blueprint viewport…</p>
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
        <p className="eyebrow">REVISION SET</p>
        <h2>{data.sheet}</h2>
        <p>{data.sheetTitle}</p>
      </div>
      {[data.baseline, data.candidate].map((revision, index) => (
        <article className="rail-revision" key={revision.label}>
          <div className="rail-sheet-preview" aria-hidden="true">
            <span>{data.sheet}</span>
            <i className={index === 1 ? "candidate-mark" : undefined} />
          </div>
          <div>
            <span className="eyebrow">{revision.label}</span>
            <h3>{revision.revision}</h3>
            <p>Issued {revision.issuedAt}</p>
          </div>
        </article>
      ))}
      <dl className="alignment-data">
        <div>
          <dt>Alignment</dt>
          <dd>
            <span className="status-dot" /> {data.alignment}
          </dd>
        </div>
        <div>
          <dt>Reprojection</dt>
          <dd>{data.reprojectionError}</dd>
        </div>
        <div>
          <dt>Page pair</dt>
          <dd>01 / 01</dd>
        </div>
      </dl>
      <p className="rail-note">
        {data.sample
          ? "This is committed sample evidence, not a live uploaded result."
          : "Live deterministic evidence. Verify every region against the source drawings."}
      </p>
    </aside>
  );
}

export function Workbench({ data = sampleWorkbench }: { data?: WorkbenchData }) {
  const [selectedId, setSelectedId] = useState(data.changes[0]?.id ?? "");
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [mode, setMode] = useState<CompareMode>("overlay");
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
          <span>Complete</span>
          <span className="technical">{data.engine}</span>
        </div>
        {data.reportUrl ? (
          <a className="export-button" href={data.reportUrl} rel="noreferrer" target="_blank">
            <Download aria-hidden="true" size={15} /> Print report
          </a>
        ) : data.sample ? (
          <Link className="export-button" href="/app/projects/new">
            <RotateCcw aria-hidden="true" size={15} /> Run fresh analysis
          </Link>
        ) : (
          <button className="export-button" disabled type="button">
            <Download aria-hidden="true" size={15} /> Export
          </button>
        )}
      </div>

      <div className="workbench-controls" aria-label="Blueprint comparison controls">
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

        <div className="control-group comparison-mode">
          <Eye aria-hidden="true" size={15} />
          <label htmlFor="compare-mode">View</label>
          <select
            id="compare-mode"
            onChange={(event) => setMode(event.target.value as CompareMode)}
            value={mode}
          >
            <option value="overlay">Overlay</option>
            <option value="split">Split</option>
            <option value="swipe">Swipe</option>
            <option value="blink">Blink</option>
            <option value="baseline">Baseline only</option>
            <option value="candidate">Candidate only</option>
          </select>
        </div>

        <div className="control-group range-control">
          <label htmlFor="overlay-opacity">Opacity</label>
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
          <Link2 aria-hidden="true" size={15} /> {synchronized ? "Views linked" : "Views unlinked"}
        </button>
      </div>

      <div className="workbench-grid">
        <RevisionRail data={data} />
        <section className="canvas-panel" aria-label="Blueprint viewport">
          <BlueprintCanvas
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
              <Focus aria-hidden="true" size={13} /> Alignment {data.alignment.toLowerCase()}
            </span>
            <span className="technical">NORMALIZED GEOMETRY · PAGE 01</span>
            <span>
              {data.reportSummary ?? "Evidence regions are selectable in the canvas and ledger."}
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
