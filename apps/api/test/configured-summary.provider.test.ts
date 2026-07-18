import { describe, expect, it, vi } from "vitest";

import type { BedrockSummaryProvider } from "../src/summary/bedrock-summary.provider.js";
import { ConfiguredSummaryProvider } from "../src/summary/configured-summary.provider.js";
import { DeterministicSummaryProvider } from "../src/summary/deterministic-summary.provider.js";
import type { SummaryChange } from "../src/summary/summary.types.js";

const changes: SummaryChange[] = [
  {
    id: "change-one",
    sequence: 1,
    changeType: "ADDED",
    category: "WALL_LINEWORK",
    confidence: 0.8,
    oldText: null,
    newText: null,
    affectedTrades: ["architectural"],
    impact: "Review coordination.",
  },
];

describe("ConfiguredSummaryProvider", () => {
  it("falls back truthfully when Bedrock is unavailable", async () => {
    process.env.SUMMARY_PROVIDER = "bedrock";
    const bedrock = {
      summarizeAnalysis: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    } as unknown as BedrockSummaryProvider;
    const provider = new ConfiguredSummaryProvider(new DeterministicSummaryProvider(), bedrock);

    const summary = await provider.summarizeAnalysis(changes);

    expect(summary.provider).toBe("DETERMINISTIC");
    expect(summary.warning).toBe("AI summary unavailable; deterministic evidence summary used.");
    expect(summary.structuredSummary).toMatchObject({ aiFallback: true });
    delete process.env.SUMMARY_PROVIDER;
  });
});
