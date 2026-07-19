import { ArrowLeft, ArrowRight, CalendarDays, FileStack, MapPin } from "lucide-react";
import Link from "next/link";

import { KnowledgeRegister } from "../../../../components/knowledge-register";
import { apiRequest } from "../../../../lib/api/client";
import {
  analysisListSchema,
  knowledgeDocumentListSchema,
  projectSchema,
  revisionListSchema,
} from "../../../../lib/api/contracts";
import { requireServerAccessToken } from "../../../../lib/api/server";
import {
  sampleChanges,
  sampleProject,
  schematicSampleChanges,
  schematicSampleProject,
} from "../../../../lib/sample-data";

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const isConstructionSample = projectId === sampleProject.id;
  const isSchematicSample = projectId === schematicSampleProject.id;
  const isSample = isConstructionSample || isSchematicSample;
  const sample = isSchematicSample ? schematicSampleProject : sampleProject;
  const sampleEvidence = isSchematicSample ? schematicSampleChanges : sampleChanges;
  const sampleAnalysisHref = `/app/analyses/${sample.analysis.id}`;

  if (!isSample) {
    const token = await requireServerAccessToken();
    const [project, revisions, analyses, knowledgeDocuments] = await Promise.all([
      apiRequest(`/projects/${projectId}`, token, projectSchema),
      apiRequest(`/projects/${projectId}/revisions`, token, revisionListSchema),
      apiRequest(`/projects/${projectId}/analyses?limit=20`, token, analysisListSchema),
      apiRequest(`/projects/${projectId}/knowledge-documents`, token, knowledgeDocumentListSchema),
    ]);
    const latest = analyses.items[0];

    return (
      <main className="app-page">
        <Link className="back-link" href="/app">
          <ArrowLeft aria-hidden="true" size={16} /> Projects
        </Link>
        <div className="app-page-heading project-heading">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="live-flag">LIVE PROJECT</span>
              <span className="profile-flag">
                {project.analysisProfile === "ENGINEERING_SCHEMATIC"
                  ? "Engineering schematic"
                  : "Construction drawing"}
              </span>
              {project.projectCode ? (
                <span className="technical text-[10px] text-[#646762]">{project.projectCode}</span>
              ) : null}
            </div>
            <h1>{project.name}</h1>
            <p>{project.description ?? "Private blueprint revision comparison"}</p>
          </div>
          {latest ? (
            <Link className="signal-button" href={`/app/analyses/${latest.id}`}>
              Open evidence review <ArrowRight aria-hidden="true" size={17} />
            </Link>
          ) : null}
        </div>

        <section className="project-facts" aria-label="Project facts">
          <div>
            <MapPin aria-hidden="true" size={18} />
            <span>Data</span>
            <strong>Private user upload</strong>
          </div>
          <div>
            <FileStack aria-hidden="true" size={18} />
            <span>Revision files</span>
            <strong>{revisions.length} validated uploads</strong>
          </div>
          <div>
            <CalendarDays aria-hidden="true" size={18} />
            <span>Updated</span>
            <strong>{new Date(project.updatedAt).toLocaleString()}</strong>
          </div>
        </section>

        <section className="revision-comparison" aria-labelledby="revision-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DRAWING SET</p>
              <h2 id="revision-heading">Compared revisions</h2>
            </div>
            <span className="technical text-xs text-[#646762]">PAGE 01</span>
          </div>
          <div className="revision-pair">
            {revisions.map((revision) => (
              <article key={revision.id}>
                <span className="eyebrow">{revision.role}</span>
                <div className="sheet-stamp">
                  {revision.mimeType === "application/pdf" ? "PDF" : "IMG"}
                </div>
                <div className="min-w-0">
                  <h3>{revision.label}</h3>
                  <p className="truncate">{revision.originalName}</p>
                  <p>
                    {(revision.byteSize / 1024 / 1024).toFixed(1)} MB · page{" "}
                    {revision.selectedPage ?? 1}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {latest ? (
          <section className="analysis-row" aria-labelledby="analysis-heading">
            <div>
              <span
                className={
                  latest.status === "FAILED" ? "status-dot status-dot-error" : "status-dot"
                }
              />
              <div>
                <p className="eyebrow">LIVE ANALYSIS · {formatStatus(latest.status)}</p>
                <h2 id="analysis-heading">Revision evidence review</h2>
                <p>
                  {latest.progress}% complete · {latest.currentStage} · {latest.engineVersion}
                </p>
              </div>
            </div>
            <Link className="row-link" href={`/app/analyses/${latest.id}`}>
              {latest.status === "COMPLETED" ? "Review changes" : "View progress"}{" "}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </section>
        ) : (
          <section className="empty-projects">
            <FileStack aria-hidden="true" size={24} />
            <div>
              <h2>No analysis queued</h2>
              <p>Start a new comparison to add a revision pair.</p>
            </div>
          </section>
        )}

        <KnowledgeRegister initialDocuments={knowledgeDocuments} projectId={projectId} />
      </main>
    );
  }

  return (
    <main className="app-page">
      <Link className="back-link" href="/app">
        <ArrowLeft aria-hidden="true" size={16} /> Projects
      </Link>
      <div className="app-page-heading project-heading">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="sample-flag">{isSample ? "BUILT-IN SAMPLE" : "FIXTURE PREVIEW"}</span>
            <span className="profile-flag">{sample.profileLabel}</span>
            <span className="technical text-[10px] text-[#646762]">{sample.number}</span>
          </div>
          <h1>{sample.name}</h1>
          <p>{sample.location}</p>
        </div>
        <Link className="signal-button" href={sampleAnalysisHref}>
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
          <strong>
            {sample.baseline.sheet} · {sample.baseline.revision} → {sample.candidate.revision}
          </strong>
        </div>
        <div>
          <CalendarDays aria-hidden="true" size={18} />
          <span>Updated</span>
          <strong>{sample.updatedAt}</strong>
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
          {[sample.baseline, sample.candidate].map((revision) => (
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
              {sampleEvidence.length} changes · {sample.analysis.engine} · completed{" "}
              {sample.analysis.completedAt}
            </p>
          </div>
        </div>
        <Link className="row-link" href={sampleAnalysisHref}>
          Review changes <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </section>
    </main>
  );
}
