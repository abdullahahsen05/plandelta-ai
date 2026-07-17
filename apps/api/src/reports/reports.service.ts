import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";
import { buildDeterministicReport } from "./deterministic-report.js";

@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService) {}

  private async requireOwnedAnalysis(ownerId: string, analysisId: string) {
    const analysis = await this.database.analysis.findFirst({
      where: { id: analysisId, project: { ownerId } },
      select: { id: true, status: true, project: { select: { name: true } } },
    });
    if (!analysis)
      throw new ApiException(
        "ANALYSIS_NOT_FOUND",
        "The analysis was not found.",
        HttpStatus.NOT_FOUND,
      );
    return analysis;
  }

  async get(ownerId: string, analysisId: string) {
    await this.requireOwnedAnalysis(ownerId, analysisId);
    const report = await this.database.analysisReport.findUnique({ where: { analysisId } });
    if (!report)
      throw new ApiException(
        "REPORT_NOT_READY",
        "The analysis report is not ready.",
        HttpStatus.NOT_FOUND,
      );
    return report;
  }

  async getPrintContext(ownerId: string, analysisId: string) {
    const analysis = await this.database.analysis.findFirst({
      where: { id: analysisId, project: { ownerId } },
      select: {
        id: true,
        status: true,
        engineVersion: true,
        metrics: true,
        warnings: true,
        completedAt: true,
        project: {
          select: {
            name: true,
            projectCode: true,
          },
        },
        baselineRevision: {
          select: {
            label: true,
            revisionCode: true,
            originalName: true,
            selectedPage: true,
            createdAt: true,
          },
        },
        candidateRevision: {
          select: {
            label: true,
            revisionCode: true,
            originalName: true,
            selectedPage: true,
            createdAt: true,
          },
        },
        changes: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            sequence: true,
            changeType: true,
            category: true,
            confidence: true,
            oldText: true,
            newText: true,
            affectedTrades: true,
            impact: true,
          },
        },
        artifacts: {
          where: { kind: { in: ["OVERLAY", "EVIDENCE_CROP"] } },
          select: {
            id: true,
            kind: true,
            metadata: true,
          },
        },
        report: true,
      },
    });
    if (!analysis) {
      throw new ApiException(
        "ANALYSIS_NOT_FOUND",
        "The analysis was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (!analysis.report) {
      throw new ApiException(
        "REPORT_NOT_READY",
        "The analysis report is not ready.",
        HttpStatus.NOT_FOUND,
      );
    }
    return analysis;
  }

  async regenerate(ownerId: string, analysisId: string) {
    const analysis = await this.requireOwnedAnalysis(ownerId, analysisId);
    if (analysis.status !== "COMPLETED") {
      throw new ApiException(
        "ANALYSIS_NOT_COMPLETE",
        "A report requires a completed analysis.",
        HttpStatus.CONFLICT,
      );
    }
    const changes = await this.database.detectedChange.findMany({
      where: { analysisId },
      orderBy: { sequence: "asc" },
    });
    const { executiveSummary, structuredSummary } = buildDeterministicReport(changes);
    return this.database.analysisReport.upsert({
      where: { analysisId },
      create: {
        analysisId,
        executiveSummary,
        structuredSummary,
        provider: "DETERMINISTIC",
        promptVersion: "deterministic-v1",
      },
      update: {
        executiveSummary,
        structuredSummary,
        provider: "DETERMINISTIC",
        modelId: null,
        promptVersion: "deterministic-v1",
      },
    });
  }
}
