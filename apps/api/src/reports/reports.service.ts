import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
    const counts = changes.reduce<Record<string, number>>((result, change) => {
      result[change.changeType] = (result[change.changeType] ?? 0) + 1;
      return result;
    }, {});
    const executiveSummary =
      changes.length === 0
        ? "No material revision regions were detected within the configured tolerance."
        : `${changes.length} evidence-based revision region${changes.length === 1 ? " was" : "s were"} detected: ${Object.entries(
            counts,
          )
            .map(([type, count]) => `${count} ${titleCase(type)}`)
            .join(", ")}. Review each region against the source drawings before coordination.`;
    return this.database.analysisReport.upsert({
      where: { analysisId },
      create: {
        analysisId,
        executiveSummary,
        structuredSummary: { counts, changeIds: changes.map((change) => change.id) },
        provider: "DETERMINISTIC",
        promptVersion: "deterministic-v1",
      },
      update: {
        executiveSummary,
        structuredSummary: { counts, changeIds: changes.map((change) => change.id) },
        provider: "DETERMINISTIC",
        modelId: null,
        promptVersion: "deterministic-v1",
      },
    });
  }
}
