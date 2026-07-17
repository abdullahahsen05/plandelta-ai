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
    response
      .type("html")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PlanDelta report</title></head><body><main><h1>Revision evidence report</h1><p>${escapeHtml(report.executiveSummary)}</p><p>Decision support only; verify against source drawings.</p></main></body></html>`,
      );
  }
}
