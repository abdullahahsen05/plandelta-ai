import { Controller, Get, Param, ParseUUIDPipe, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { ReportsService } from "./reports.service.js";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ??
      character,
  );
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date | null, includeTime = false) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "UTC",
  }).format(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function semanticClass(changeType: string) {
  if (changeType === "ADDED") return "added";
  if (changeType === "REMOVED") return "removed";
  return "modified";
}

@ApiTags("reports")
@ApiBearerAuth()
@Controller("analyses/:analysisId/report")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
  ) {
    return this.reports.get(auth.userId, analysisId);
  }

  @Post("regenerate")
  regenerate(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
  ) {
    return this.reports.regenerate(auth.userId, analysisId);
  }

  @Get("print")
  async print(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
    @Res() response: Response,
  ) {
    const context = await this.reports.getPrintContext(auth.userId, analysisId);
    const report = context.report;
    if (!report) throw new Error("Print context did not include its verified report.");
    const counts = context.changes.reduce<Record<string, number>>((result, change) => {
      result[change.changeType] = (result[change.changeType] ?? 0) + 1;
      return result;
    }, {});
    const countSummary = Object.entries(counts)
      .map(
        ([type, count]) =>
          `<span class="count-item ${semanticClass(type)}"><b>${count}</b> ${escapeHtml(titleCase(type))}</span>`,
      )
      .join("");
    const evidenceBySequence = new Map<number, string>();
    for (const artifact of context.artifacts) {
      if (artifact.kind !== "EVIDENCE_CROP") continue;
      const sequence = Number(asRecord(artifact.metadata).sequence);
      if (Number.isInteger(sequence) && sequence > 0) evidenceBySequence.set(sequence, artifact.id);
    }
    const overlay = context.artifacts.find((artifact) => artifact.kind === "OVERLAY");
    const alignment = asRecord(asRecord(context.metrics).alignment);
    const alignmentLabel =
      typeof alignment.quality === "string"
        ? titleCase(alignment.quality)
        : typeof alignment.method === "string"
          ? titleCase(alignment.method)
          : "Recorded";
    const reprojection =
      typeof alignment.reprojectionErrorPx === "number"
        ? `${alignment.reprojectionErrorPx.toFixed(2)} px`
        : "Not reported";
    const warnings = stringArray(context.warnings);
    const shortId = context.id.slice(0, 8).toUpperCase();
    const changeRecords = context.changes
      .map((change) => {
        const category = titleCase(change.category);
        const type = titleCase(change.changeType);
        const title = `${category} ${type.toLowerCase()}`;
        const evidenceId = evidenceBySequence.get(change.sequence);
        const trades =
          change.affectedTrades.length > 0 ? change.affectedTrades.join(", ") : "Not classified";
        const textComparison =
          change.oldText || change.newText
            ? `<dl class="text-change"><div><dt>Before</dt><dd>${escapeHtml(change.oldText ?? "Not present")}</dd></div><div class="arrow" aria-hidden="true">→</div><div><dt>Revised</dt><dd>${escapeHtml(change.newText ?? "Removed")}</dd></div></dl>`
            : `<p class="geometry-note">Geometry changed in this area; no text change was detected.</p>`;
        return `<article class="change-record">
          <header class="change-record__header">
            <div class="change-index">${String(change.sequence).padStart(2, "0")}</div>
            <div class="change-title">
              <div><span class="type-label ${semanticClass(change.changeType)}">${escapeHtml(type)}</span><span class="category">${escapeHtml(category)}</span></div>
              <h3>${escapeHtml(title)}</h3>
            </div>
            <div class="confidence"><span>Confidence</span><strong>${Math.round(change.confidence * 100)}%</strong></div>
          </header>
          <div class="change-record__body">
            ${
              evidenceId
                ? `<figure class="evidence"><img src="/api/artifacts/${escapeHtml(evidenceId)}" alt="Before and revised evidence for change ${change.sequence}"><figcaption>Before on left · revised on right</figcaption></figure>`
                : `<div class="evidence-missing">Evidence crop unavailable. Review the marked area in the source drawings.</div>`
            }
            <div class="change-detail">
              ${textComparison}
              <dl class="change-meta">
                <div><dt>Relevant work</dt><dd>${escapeHtml(trades)}</dd></div>
                <div><dt>Coordination note</dt><dd>${escapeHtml(change.impact ?? "Verify this change against the source drawings before coordination.")}</dd></div>
              </dl>
            </div>
          </div>
        </article>`;
      })
      .join("");
    const reviewActions = context.changes
      .map((change) => {
        const title = `${titleCase(change.category)} ${titleCase(change.changeType).toLowerCase()}`;
        const trades =
          change.affectedTrades.length > 0
            ? change.affectedTrades.join(", ")
            : "the responsible trade";
        return `<li><span>${String(change.sequence).padStart(2, "0")}</span><p><strong>${escapeHtml(title)}</strong> — Review with ${escapeHtml(trades)}. ${escapeHtml(change.impact ?? "Confirm against the source drawings before coordination.")}</p></li>`;
      })
      .join("");
    const warningList =
      warnings.length > 0
        ? `<div class="method-warnings"><h3>Processing notes</h3><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>`
        : "";
    const reportHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(context.project.name)} · PlanDelta revision report</title>
  <style>
    :root{--limestone:#f3f0e8;--paper:#fbfaf6;--ink:#171a1c;--muted:#646762;--line:#d8d4ca;--orange:#e6532f;--navy:#10263b;--added:#17845b;--removed:#c53f3f;--modified:#d88916}
    *{box-sizing:border-box}
    html{background:var(--limestone);color:var(--ink);font-family:"Segoe UI",Arial,sans-serif}
    body{margin:0;font-size:14px;line-height:1.55}
    .screen-note{max-width:1040px;margin:20px auto 0;padding:10px 16px;border:1px solid #c7c3ba;background:#ebe8df;color:#565954;font-size:12px}
    .report{max-width:1040px;margin:12px auto 40px;background:var(--paper);box-shadow:0 14px 42px rgb(29 27 22 / .08)}
    .report-header{position:relative;padding:42px 52px 34px;border-top:7px solid var(--orange);border-bottom:1px solid var(--line)}
    .report-header:after{content:"";position:absolute;right:52px;top:42px;width:68px;height:68px;border:1px solid #8ea8b9;background:linear-gradient(rgb(16 38 59 / .08) 1px,transparent 1px),linear-gradient(90deg,rgb(16 38 59 / .08) 1px,transparent 1px);background-size:9px 9px}
    .eyebrow,.technical{font-family:Consolas,"Courier New",monospace;text-transform:uppercase;letter-spacing:.1em}
    .eyebrow{font-size:11px;font-weight:700;color:var(--muted)}
    h1{max-width:720px;margin:10px 0 6px;font-size:36px;line-height:1.08;font-weight:650;letter-spacing:-.025em}
    .report-subtitle{margin:0;color:var(--muted)}
    .report-id{margin-top:22px;font-size:11px;color:var(--muted)}
    .project-band{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;border-bottom:1px solid var(--line)}
    .project-band>div{min-width:0;padding:15px 18px;border-right:1px solid var(--line)}
    .project-band>div:first-child{padding-left:52px}
    .project-band>div:last-child{border-right:0;padding-right:52px}
    dt{font-size:10px;line-height:1.4;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
    dd{margin:4px 0 0;font-weight:650}
    .report-section{padding:34px 52px;border-bottom:1px solid var(--line)}
    .section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:18px}
    .section-heading h2{margin:0;font-size:20px;line-height:1.25}
    .section-heading p{margin:0;color:var(--muted);font-size:12px}
    .summary-grid{display:grid;grid-template-columns:minmax(0,1.7fr) 230px;gap:38px;align-items:stretch}
    .summary-copy{margin:0;font-size:17px;line-height:1.55}
    .result-block{display:flex;flex-direction:column;justify-content:space-between;border-left:4px solid var(--orange);background:#f0ede5;padding:18px 20px}
    .result-number{font:700 44px/1 Consolas,"Courier New",monospace}
    .result-label{margin-top:5px;font-weight:650}
    .count-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:16px}
    .count-item{font-size:11px;border-left:2px solid currentColor;padding-left:7px}
    .count-item.added{color:var(--added)}.count-item.removed{color:var(--removed)}.count-item.modified{color:#9a620e}
    .revision-pair{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line)}
    .revision{display:grid;grid-template-columns:46px 1fr;gap:14px;padding:18px;border-right:1px solid var(--line)}
    .revision:last-child{border-right:0}
    .revision-key{display:grid;width:42px;height:42px;place-items:center;border:1px solid #8ea8b9;background:#e4ebee;color:var(--navy);font:700 14px Consolas,monospace}
    .revision--candidate .revision-key{border-color:var(--modified);background:#fff3d9;color:#8b590f}
    .revision h3{margin:0 0 3px;font-size:15px}.revision p{margin:0;color:var(--muted);font-size:12px}.revision .file{margin-top:8px;color:var(--ink);overflow-wrap:anywhere}
    .overview{margin:0;border:1px solid var(--line);background:#e5e2da}
    .overview img{display:block;width:100%;max-height:590px;object-fit:contain}
    .overview figcaption,.evidence figcaption{padding:8px 10px;background:#ece9e1;color:var(--muted);font-size:10px;text-align:center}
    .change-register{padding-top:34px}
    .change-record{break-inside:avoid;border:1px solid var(--line);margin-bottom:18px;background:#fff}
    .change-record__header{display:grid;grid-template-columns:44px 1fr 82px;gap:14px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line)}
    .change-index{font:700 12px Consolas,monospace;color:var(--muted)}
    .change-title h3{margin:5px 0 0;font-size:16px}
    .type-label{display:inline-block;border-left:3px solid currentColor;padding-left:7px;font:700 10px Consolas,monospace;text-transform:uppercase;letter-spacing:.07em}
    .type-label.added{color:var(--added)}.type-label.removed{color:var(--removed)}.type-label.modified{color:#9a620e}
    .category{margin-left:9px;color:var(--muted);font-size:11px}
    .confidence{text-align:right}.confidence span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.confidence strong{font:700 16px Consolas,monospace}
    .change-record__body{display:grid;grid-template-columns:minmax(260px,.95fr) minmax(0,1.35fr)}
    .evidence{margin:0;border-right:1px solid var(--line);background:#eef0ec}
    .evidence img{display:block;width:100%;height:210px;object-fit:contain}
    .evidence-missing{display:grid;min-height:210px;place-items:center;padding:24px;border-right:1px solid var(--line);background:#f0ede5;color:var(--muted);text-align:center;font-size:12px}
    .change-detail{padding:20px}
    .text-change{display:grid;grid-template-columns:1fr 20px 1fr;align-items:center;margin:0 0 18px;padding-bottom:16px;border-bottom:1px solid var(--line)}
    .text-change dd{font-size:12px}.text-change .arrow{text-align:center;color:var(--muted)}
    .geometry-note{margin:0 0 18px;padding-bottom:16px;border-bottom:1px solid var(--line);color:var(--muted);font-size:12px}
    .change-meta{margin:0}.change-meta>div+div{margin-top:14px}.change-meta dd{font-size:12px;font-weight:500;line-height:1.55}
    .actions{margin:0;padding:0;list-style:none;border-top:1px solid var(--line)}
    .actions li{display:grid;grid-template-columns:44px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
    .actions li>span{font:700 11px Consolas,monospace;color:var(--muted)}.actions p{margin:0;font-size:12px}
    .method-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line)}
    .method-grid>div{padding:13px;border-right:1px solid var(--line)}.method-grid>div:last-child{border-right:0}
    .method-warnings{margin-top:18px;padding:14px 16px;border-left:3px solid var(--modified);background:#fff8e8}.method-warnings h3{margin:0 0 6px;font-size:13px}.method-warnings ul{margin:0;padding-left:18px;font-size:12px}
    .notice{margin:0;padding:20px 52px;border-left:5px solid var(--modified);background:#fff8e8;color:#50534f;font-size:12px}
    .report-footer{display:flex;justify-content:space-between;gap:20px;padding:18px 52px;color:var(--muted);font:10px Consolas,"Courier New",monospace;text-transform:uppercase;letter-spacing:.05em}
    @media(max-width:760px){.report{margin:0}.screen-note{margin:0}.report-header,.report-section{padding:28px 22px}.report-header:after{display:none}.project-band{grid-template-columns:1fr 1fr}.project-band>div,.project-band>div:first-child,.project-band>div:last-child{padding:13px 18px;border-bottom:1px solid var(--line)}.summary-grid,.change-record__body{grid-template-columns:1fr}.revision-pair{grid-template-columns:1fr}.revision{border-right:0;border-bottom:1px solid var(--line)}.evidence,.evidence-missing{border-right:0;border-bottom:1px solid var(--line)}.method-grid{grid-template-columns:1fr 1fr}.method-grid>div{border-bottom:1px solid var(--line)}.notice,.report-footer{padding-left:22px;padding-right:22px}}
    @page{size:A4;margin:12mm}
    @media print{html,body{background:#fff}.screen-note{display:none}.report{max-width:none;margin:0;box-shadow:none}.report-header{padding-top:20px}.report-section{padding-top:24px;padding-bottom:24px}.report-header,.report-section,.project-band,.notice,.report-footer{padding-left:0;padding-right:0}.project-band>div:first-child{padding-left:0}.project-band>div:last-child{padding-right:0}.change-record{page-break-inside:avoid}.overview img{max-height:460px}.evidence img{height:170px}}
  </style>
</head>
<body>
  <div class="screen-note"><strong>Print-ready coordination report.</strong> Use your browser’s Print command (Ctrl+P) to save as PDF or print.</div>
  <main class="report">
    <header class="report-header">
      <div class="eyebrow">PlanDelta · verified drawing evidence</div>
      <h1>Revision comparison report</h1>
      <p class="report-subtitle">${escapeHtml(context.project.name)} · Baseline against revised drawing</p>
      <div class="report-id technical">Report ${escapeHtml(shortId)} · Generated ${escapeHtml(formatDate(report.generatedAt, true))} UTC</div>
    </header>

    <dl class="project-band">
      <div><dt>Project</dt><dd>${escapeHtml(context.project.name)}</dd></div>
      <div><dt>Project code</dt><dd>${escapeHtml(context.project.projectCode ?? "Not assigned")}</dd></div>
      <div><dt>Analysis status</dt><dd>Complete</dd></div>
      <div><dt>Completed</dt><dd>${escapeHtml(formatDate(context.completedAt))}</dd></div>
    </dl>

    <section class="report-section">
      <div class="section-heading"><h2>Executive summary</h2><p>Evidence-based result</p></div>
      <div class="summary-grid">
        <p class="summary-copy">${escapeHtml(report.executiveSummary)}</p>
        <div class="result-block">
          <div><div class="result-number">${String(context.changes.length).padStart(2, "0")}</div><div class="result-label">${context.changes.length === 1 ? "change identified" : "changes identified"}</div></div>
          ${countSummary ? `<div class="count-list">${countSummary}</div>` : `<div class="count-list"><span>No material changes</span></div>`}
        </div>
      </div>
    </section>

    <section class="report-section">
      <div class="section-heading"><h2>Drawing pair</h2><p>Selected pages used for this analysis</p></div>
      <div class="revision-pair">
        <article class="revision">
          <div class="revision-key">A</div>
          <div><div class="eyebrow">Before · baseline</div><h3>${escapeHtml(context.baselineRevision.label)}</h3><p>${escapeHtml(context.baselineRevision.revisionCode ?? "No revision code")} · Page ${context.baselineRevision.selectedPage ?? 1}</p><p class="file">${escapeHtml(context.baselineRevision.originalName)}</p></div>
        </article>
        <article class="revision revision--candidate">
          <div class="revision-key">B</div>
          <div><div class="eyebrow">Revised · candidate</div><h3>${escapeHtml(context.candidateRevision.label)}</h3><p>${escapeHtml(context.candidateRevision.revisionCode ?? "No revision code")} · Page ${context.candidateRevision.selectedPage ?? 1}</p><p class="file">${escapeHtml(context.candidateRevision.originalName)}</p></div>
        </article>
      </div>
    </section>

    ${
      overlay
        ? `<section class="report-section"><div class="section-heading"><h2>Comparison overview</h2><p>Aligned visual evidence</p></div><figure class="overview"><img src="/api/artifacts/${escapeHtml(overlay.id)}" alt="Aligned comparison overview showing detected revision evidence"><figcaption>Computer-aligned overlay. Semantic markers identify candidate changes for review.</figcaption></figure></section>`
        : ""
    }

    <section class="report-section change-register">
      <div class="section-heading"><h2>Change register</h2><p>${context.changes.length} ordered ${context.changes.length === 1 ? "finding" : "findings"}</p></div>
      ${changeRecords || `<div class="evidence-missing">No material revision regions were detected within the configured tolerance.</div>`}
    </section>

    ${
      reviewActions
        ? `<section class="report-section"><div class="section-heading"><h2>Coordination actions</h2><p>Review before downstream work</p></div><ol class="actions">${reviewActions}</ol></section>`
        : ""
    }

    <section class="report-section">
      <div class="section-heading"><h2>Method and quality</h2><p>Traceability for this run</p></div>
      <dl class="method-grid">
        <div><dt>Engine</dt><dd>${escapeHtml(context.engineVersion)}</dd></div>
        <div><dt>Summary source</dt><dd>${escapeHtml(titleCase(report.provider))}</dd></div>
        <div><dt>Alignment</dt><dd>${escapeHtml(alignmentLabel)}</dd></div>
        <div><dt>Alignment error</dt><dd>${escapeHtml(reprojection)}</dd></div>
      </dl>
      ${warningList}
    </section>

    <p class="notice"><strong>Decision support only.</strong> PlanDelta identifies evidence for review; it does not replace professional judgment, contract-document review, field verification, coordination, procurement approval, or construction authorization.</p>
    <footer class="report-footer"><span>PlanDelta · revision intelligence</span><span>Report ${escapeHtml(shortId)} · ${escapeHtml(formatDate(report.generatedAt))}</span></footer>
  </main>
</body>
</html>`;
    response.type("html").send(reportHtml);
  }
}
