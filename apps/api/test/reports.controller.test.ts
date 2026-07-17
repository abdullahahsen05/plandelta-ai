import { describe, expect, it, vi } from "vitest";

import { ReportsController } from "../src/reports/reports.controller.js";

describe("ReportsController", () => {
  it("renders a print-ready evidence report from owned analysis data", async () => {
    const getPrintContext = vi.fn().mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      status: "COMPLETED",
      engineVersion: "vision-1.0",
      metrics: {
        alignment: { quality: "strong", reprojectionErrorPx: 1.25 },
      },
      warnings: [],
      completedAt: new Date("2026-07-17T12:20:00.000Z"),
      project: { name: "Office <Tower>", projectCode: "PD-101" },
      baselineRevision: {
        label: "Earlier revision",
        revisionCode: "A",
        originalName: "baseline.png",
        selectedPage: 1,
        createdAt: new Date("2026-07-16T10:00:00.000Z"),
      },
      candidateRevision: {
        label: "Later revision",
        revisionCode: "B",
        originalName: "revised.png",
        selectedPage: 1,
        createdAt: new Date("2026-07-17T10:00:00.000Z"),
      },
      changes: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          sequence: 1,
          changeType: "ADDED",
          category: "WALL_LINEWORK",
          confidence: 0.88,
          oldText: null,
          newText: null,
          affectedTrades: ["architectural", "structural"],
          impact: "Review the new wall before coordination.",
        },
      ],
      artifacts: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          kind: "OVERLAY",
          metadata: {},
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          kind: "EVIDENCE_CROP",
          metadata: { sequence: 1 },
        },
      ],
      report: {
        executiveSummary: "One added wall region requires review.",
        provider: "DETERMINISTIC",
        generatedAt: new Date("2026-07-17T12:20:15.000Z"),
      },
    });
    const controller = new ReportsController({ getPrintContext } as never);
    let html = "";
    const response = {
      type: vi.fn().mockReturnThis(),
      send: vi.fn((value: string) => {
        html = value;
      }),
    };

    await controller.print(
      { userId: "55555555-5555-4555-8555-555555555555" } as never,
      "11111111-1111-4111-8111-111111111111",
      response as never,
    );

    expect(getPrintContext).toHaveBeenCalledWith(
      "55555555-5555-4555-8555-555555555555",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(html).toContain("Revision comparison report");
    expect(html).toContain("Office &lt;Tower&gt;");
    expect(html).not.toContain("Office <Tower>");
    expect(html).toContain("Wall Linework added");
    expect(html).toContain("/api/artifacts/33333333-3333-4333-8333-333333333333");
    expect(html).toContain("/api/artifacts/44444444-4444-4444-8444-444444444444");
    expect(html).toContain("architectural, structural");
    expect(response.type).toHaveBeenCalledWith("html");
  });
});
