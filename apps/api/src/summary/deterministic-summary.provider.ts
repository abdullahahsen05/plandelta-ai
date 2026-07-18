import { Injectable } from "@nestjs/common";

import { buildDeterministicReport } from "../reports/deterministic-report.js";
import type { GeneratedSummary, SummaryChange, SummaryProvider } from "./summary.types.js";

@Injectable()
export class DeterministicSummaryProvider implements SummaryProvider {
  summarizeAnalysis(changes: SummaryChange[]): Promise<GeneratedSummary> {
    return Promise.resolve({
      ...buildDeterministicReport(changes),
      provider: "DETERMINISTIC",
      modelId: null,
      promptVersion: "deterministic-v1",
    });
  }
}
