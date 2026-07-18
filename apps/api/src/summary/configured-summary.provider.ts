import { Injectable, Logger } from "@nestjs/common";

import { BedrockSummaryProvider } from "./bedrock-summary.provider.js";
import { DeterministicSummaryProvider } from "./deterministic-summary.provider.js";
import type { GeneratedSummary, SummaryChange, SummaryProvider } from "./summary.types.js";

@Injectable()
export class ConfiguredSummaryProvider implements SummaryProvider {
  private readonly logger = new Logger(ConfiguredSummaryProvider.name);

  constructor(
    private readonly deterministic: DeterministicSummaryProvider,
    private readonly bedrock: BedrockSummaryProvider,
  ) {}

  async summarizeAnalysis(changes: SummaryChange[]): Promise<GeneratedSummary> {
    if (process.env.SUMMARY_PROVIDER?.toLowerCase() !== "bedrock") {
      return this.deterministic.summarizeAnalysis(changes);
    }
    try {
      return await this.bedrock.summarizeAnalysis(changes);
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: "bedrock_summary_fallback",
          reason: "provider_unavailable_or_invalid",
        }),
      );
      const fallback = await this.deterministic.summarizeAnalysis(changes);
      return {
        ...fallback,
        structuredSummary: {
          ...fallback.structuredSummary,
          aiFallback: true,
        },
        warning: "AI summary unavailable; deterministic evidence summary used.",
      };
    }
  }
}
