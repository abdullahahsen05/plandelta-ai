import { Injectable } from "@nestjs/common";

import { buildDeterministicReport } from "../reports/deterministic-report.js";
import type {
  GeneratedSummary,
  SummaryChange,
  SummaryContext,
  SummaryProvider,
} from "./summary.types.js";

@Injectable()
export class DeterministicSummaryProvider implements SummaryProvider {
  summarizeAnalysis(changes: SummaryChange[], context?: SummaryContext): Promise<GeneratedSummary> {
    return Promise.resolve({
      ...buildDeterministicReport(changes, context?.analysisProfile),
      provider: "DETERMINISTIC",
      modelId: null,
      promptVersion: "deterministic-v1",
    });
  }
}
