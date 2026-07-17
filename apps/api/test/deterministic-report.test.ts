import { describe, expect, it } from "vitest";

import { buildDeterministicReport } from "../src/reports/deterministic-report.js";

describe("buildDeterministicReport", () => {
  it("summarizes persisted evidence by type", () => {
    const report = buildDeterministicReport([
      { id: "change-1", changeType: "ADDED" },
      { id: "change-2", changeType: "TEXT_CHANGED" },
    ]);

    expect(report.executiveSummary).toContain("2 evidence-based revision regions were detected");
    expect(report.structuredSummary).toEqual({
      counts: { ADDED: 1, TEXT_CHANGED: 1 },
      changeIds: ["change-1", "change-2"],
    });
  });

  it("reports a clean comparison without inventing changes", () => {
    const report = buildDeterministicReport([]);
    expect(report.executiveSummary).toContain("No material revision regions were detected");
    expect(report.structuredSummary).toEqual({ counts: {}, changeIds: [] });
  });
});
