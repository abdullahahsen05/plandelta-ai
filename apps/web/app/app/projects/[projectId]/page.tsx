import { ArrowLeft, ArrowRight, CalendarDays, FileStack, MapPin } from "lucide-react";
import Link from "next/link";

import { sampleChanges, sampleProject } from "../../../../lib/sample-data";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const isSample = projectId === sampleProject.id;

  return (
    <main className="app-page">
      <Link className="back-link" href="/app">
        <ArrowLeft aria-hidden="true" size={16} /> Projects
      </Link>
      <div className="app-page-heading project-heading">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="sample-flag">{isSample ? "BUILT-IN SAMPLE" : "FIXTURE PREVIEW"}</span>
            <span className="technical text-[10px] text-[#646762]">{sampleProject.number}</span>
          </div>
          <h1>{sampleProject.name}</h1>
          <p>{sampleProject.location}</p>
        </div>
        <Link className="signal-button" href="/app/analyses/sample">
          Open evidence review <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>

      <section className="project-facts" aria-label="Project facts">
        <div>
          <MapPin aria-hidden="true" size={18} />
          <span>Data</span>
          <strong>Committed sample fixture</strong>
        </div>
        <div>
          <FileStack aria-hidden="true" size={18} />
          <span>Comparison</span>
          <strong>A2.14 · Rev 03 → Rev 04</strong>
        </div>
        <div>
          <CalendarDays aria-hidden="true" size={18} />
          <span>Updated</span>
          <strong>{sampleProject.updatedAt}</strong>
        </div>
      </section>

      <section className="revision-comparison" aria-labelledby="revision-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DRAWING SET</p>
            <h2 id="revision-heading">Compared revisions</h2>
          </div>
          <span className="technical text-xs text-[#646762]">ALIGNMENT · STRONG</span>
        </div>
        <div className="revision-pair">
          {[sampleProject.baseline, sampleProject.candidate].map((revision) => (
            <article key={revision.label}>
              <span className="eyebrow">{revision.label}</span>
              <div className="sheet-stamp">{revision.sheet}</div>
              <div>
                <h3>{revision.revision}</h3>
                <p>{revision.title}</p>
                <p>Issued {revision.issuedAt}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-row" aria-labelledby="analysis-heading">
        <div>
          <span className="status-dot" />
          <div>
            <p className="eyebrow">PRECOMPUTED SAMPLE</p>
            <h2 id="analysis-heading">Revision evidence review</h2>
            <p>
              {sampleChanges.length} changes · {sampleProject.analysis.engine} · completed{" "}
              {sampleProject.analysis.completedAt}
            </p>
          </div>
        </div>
        <Link className="row-link" href="/app/analyses/sample">
          Review changes <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </section>
    </main>
  );
}
