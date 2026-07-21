import { schematicSampleWorkbench, Workbench } from "../../../../components/workbench";
import type { WorkbenchData } from "../../../../components/workbench";
import { AnalysisProgress } from "../../../../components/analysis-progress";
import { apiRequest } from "../../../../lib/api/client";
import {
  analysisSchema,
  artifactListSchema,
  changeListSchema,
  knowledgeDocumentListSchema,
  projectSchema,
  reportSchema,
  revisionListSchema,
} from "../../../../lib/api/contracts";
import { requireServerAccessToken } from "../../../../lib/api/server";
import {
  sampleProject,
  schematicSampleProject,
  type ChangeKind,
} from "../../../../lib/sample-data";

function changeKind(value: string): ChangeKind {
  if (value === "ADDED") return "added";
  if (value === "REMOVED") return "removed";
  return "modified";
}

function metricNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;
  if (analysisId === sampleProject.analysis.id) return <Workbench />;
  if (analysisId === schematicSampleProject.analysis.id) {
    return <Workbench data={schematicSampleWorkbench} />;
  }

  const token = await requireServerAccessToken();
  const analysis = await apiRequest(`/analyses/${analysisId}`, token, analysisSchema);
  if (analysis.status !== "COMPLETED") return <AnalysisProgress initial={analysis} />;

  const [project, revisions, changePage, artifacts, report, knowledgeDocuments] = await Promise.all(
    [
      apiRequest(`/projects/${analysis.projectId}`, token, projectSchema),
      apiRequest(`/projects/${analysis.projectId}/revisions`, token, revisionListSchema),
      apiRequest(`/analyses/${analysis.id}/changes?limit=100`, token, changeListSchema),
      apiRequest(`/analyses/${analysis.id}/artifacts`, token, artifactListSchema),
      apiRequest(`/analyses/${analysis.id}/report`, token, reportSchema),
      apiRequest(
        `/projects/${analysis.projectId}/knowledge-documents`,
        token,
        knowledgeDocumentListSchema,
      ),
    ],
  );
  const baselineRevision = revisions.find(
    (revision) => revision.id === analysis.baselineRevisionId,
  );
  const candidateRevision = revisions.find(
    (revision) => revision.id === analysis.candidateRevisionId,
  );
  const baselineArtifact = artifacts.find((artifact) => artifact.kind === "BASELINE_RENDER");
  const candidateArtifact = artifacts.find((artifact) => artifact.kind === "ALIGNED_CANDIDATE");
  const baselineIsImage = baselineRevision?.mimeType.startsWith("image/") ?? false;
  const candidateIsImage = candidateRevision?.mimeType.startsWith("image/") ?? false;
  const alignment = analysis.metrics.alignment;
  const alignmentRecord =
    alignment && typeof alignment === "object" ? (alignment as Record<string, unknown>) : {};
  const evidenceBySequence = new Map(
    artifacts
      .filter((artifact) => artifact.kind === "EVIDENCE_CROP")
      .map((artifact) => [Number(artifact.metadata.sequence), artifact.id]),
  );
  const changes = changePage.items.map((change) => ({
    id: change.id,
    sequence: change.sequence,
    title: `${change.category.toLowerCase().replaceAll("_", " ")} ${change.changeType.toLowerCase().replaceAll("_", " ")}`,
    kind: changeKind(change.changeType),
    category: change.category.toLowerCase().replaceAll("_", " "),
    confidence: change.confidence,
    trades: change.affectedTrades,
    oldText: change.oldText,
    newText: change.newText,
    impact: change.impact ?? "Review this evidence region against the source drawings.",
    box: { x: change.x, y: change.y, width: change.width, height: change.height },
    evidenceUrl: evidenceBySequence.has(change.sequence)
      ? `/api/artifacts/${evidenceBySequence.get(change.sequence)}`
      : undefined,
  }));
  const data: WorkbenchData = {
    sample: false,
    analysisId: analysis.id,
    projectId: project.id,
    projectName: project.name,
    analysisProfile: analysis.analysisProfile,
    profileLabel:
      analysis.analysisProfile === "ENGINEERING_SCHEMATIC"
        ? "Engineering schematic"
        : "Construction drawing",
    comparisonLabel: `${baselineRevision?.revisionCode ?? "Baseline"} → ${candidateRevision?.revisionCode ?? "Candidate"}`,
    sheet: `PAGE ${String(candidateRevision?.selectedPage ?? 1).padStart(2, "0")}`,
    sheetTitle: candidateRevision?.originalName ?? "Blueprint comparison",
    baseline: {
      label: "Baseline",
      revision: baselineRevision?.label ?? "Earlier revision",
      issuedAt: baselineRevision ? new Date(baselineRevision.createdAt).toLocaleDateString() : "—",
    },
    candidate: {
      label: "Candidate",
      revision: candidateRevision?.label ?? "Later revision",
      issuedAt: candidateRevision
        ? new Date(candidateRevision.createdAt).toLocaleDateString()
        : "—",
    },
    engine: analysis.engineVersion,
    alignment: String(alignmentRecord.quality ?? alignmentRecord.method ?? "verified"),
    reprojectionError: `${metricNumber(alignmentRecord.reprojectionErrorPx).toFixed(2)} px`,
    changes,
    baselineImageUrl:
      baselineIsImage && baselineRevision
        ? `/api/revisions/${baselineRevision.id}/preview`
        : baselineArtifact
          ? `/api/artifacts/${baselineArtifact.id}`
          : undefined,
    candidateImageUrl:
      candidateIsImage && candidateRevision
        ? `/api/revisions/${candidateRevision.id}/preview`
        : candidateArtifact
          ? `/api/artifacts/${candidateArtifact.id}`
          : undefined,
    alignedCandidateImageUrl: candidateArtifact
      ? `/api/artifacts/${candidateArtifact.id}`
      : undefined,
    documentWidth: baselineArtifact?.widthPx ?? undefined,
    documentHeight: baselineArtifact?.heightPx ?? undefined,
    reportSummary: report.executiveSummary,
    summaryProvider: report.provider === "BEDROCK" ? "BEDROCK" : "DETERMINISTIC",
    reportUrl: `/api/analyses/${analysis.id}/report`,
    knowledgeDocuments,
  };
  return <Workbench data={data} />;
}
