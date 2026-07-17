import { ArrowRight, FileSearch, Plus } from "lucide-react";
import Link from "next/link";

import { changeKindMeta, sampleChanges, sampleProject } from "../../lib/sample-data";

export default function ProjectsPage() {
  const counts = sampleChanges.reduce(
    (result, change) => ({ ...result, [change.kind]: result[change.kind] + 1 }),
    { added: 0, modified: 0, removed: 0 },
  );

  return (
    <main className="app-page">
      <div className="app-page-heading">
        <div>
          <p className="eyebrow">REVISION WORKSPACE</p>
          <h1>Projects</h1>
          <p>Review drawing revisions against traceable visual evidence.</p>
        </div>
        <Link className="signal-button" href="/app/projects/new">
          <Plus aria-hidden="true" size={17} /> New comparison
        </Link>
      </div>

      <section aria-labelledby="sample-project-heading" className="project-table-shell">
        <div className="project-table-header">
          <span>Project</span>
          <span>Latest comparison</span>
          <span>Evidence</span>
          <span aria-hidden="true" />
        </div>
        <article className="project-table-row">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="sample-flag">BUILT-IN SAMPLE</span>
              <span className="technical text-[10px] text-[#646762]">{sampleProject.number}</span>
            </div>
            <h2 id="sample-project-heading">{sampleProject.name}</h2>
            <p>{sampleProject.location}</p>
          </div>
          <div>
            <span className="technical text-[11px] text-[#646762]">A2.14 · REV 03 → 04</span>
            <p className="mt-1 font-medium">{sampleProject.analysis.status}</p>
            <p>{sampleProject.analysis.completedAt}</p>
          </div>
          <div className="change-counts" aria-label="Four sample changes">
            {(["added", "modified", "removed"] as const).map((kind) => (
              <span key={kind} style={{ borderColor: changeKindMeta[kind].color }}>
                <b style={{ color: changeKindMeta[kind].color }}>{counts[kind]}</b>{" "}
                {changeKindMeta[kind].label}
              </span>
            ))}
          </div>
          <Link
            aria-label={`Open ${sampleProject.name}`}
            className="row-action"
            href={`/app/projects/${sampleProject.id}`}
          >
            <ArrowRight aria-hidden="true" size={19} />
          </Link>
        </article>
      </section>

      <section className="empty-projects" aria-labelledby="first-comparison-heading">
        <FileSearch aria-hidden="true" size={28} strokeWidth={1.5} />
        <div>
          <h2 id="first-comparison-heading">Add your first live comparison</h2>
          <p>
            Upload a baseline and candidate revision. Results will remain separate from the labelled
            sample above.
          </p>
        </div>
        <Link className="text-action" href="/app/projects/new">
          Prepare revisions <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>
    </main>
  );
}
