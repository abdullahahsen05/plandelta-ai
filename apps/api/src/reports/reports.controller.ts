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
    const report = await this.reports.get(auth.userId, analysisId);
    const structured = report.structuredSummary as {
      counts?: Record<string, unknown>;
    };
    const countRows = Object.entries(structured.counts ?? {})
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .map(
        ([type, count]) =>
          `<tr><th scope="row">${escapeHtml(type.toLowerCase().replaceAll("_", " "))}</th><td>${count}</td></tr>`,
      )
      .join("");
    response
      .type("html")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PlanDelta report</title><style>body{margin:0;background:#f3f0e8;color:#171a1c;font:15px/1.6 Arial,sans-serif}main{max-width:760px;margin:40px auto;background:#fff;padding:48px;border-top:6px solid #e6532f}header{border-bottom:1px solid #c7c3ba;padding-bottom:20px;margin-bottom:28px}.brand{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#646762}h1{font-size:32px;line-height:1.15;margin:8px 0}h2{font-size:17px;margin-top:30px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #d8d4ca;text-align:left;text-transform:capitalize}td{text-align:right;font-family:monospace}.notice{margin-top:36px;padding:14px;border-left:3px solid #d88916;background:#fff8e8;color:#555}@media print{body{background:#fff}main{margin:0;max-width:none;padding:24px}}</style></head><body><main><header><span class="brand">PlanDelta · deterministic evidence</span><h1>Revision evidence report</h1><p>Generated ${escapeHtml(report.generatedAt.toISOString())} · ${escapeHtml(report.provider)}</p></header><h2>Executive summary</h2><p>${escapeHtml(report.executiveSummary)}</p>${countRows ? `<h2>Evidence region counts</h2><table><tbody>${countRows}</tbody></table>` : ""}<p class="notice">Decision support only. Verify every finding against the source drawings before coordination, procurement, or construction.</p></main></body></html>`,
      );
  }
}
