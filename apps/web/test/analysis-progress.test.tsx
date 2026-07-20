import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest, channel, getSession, push, refresh } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  getSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: "safe-test-token" } },
  }),
  channel: {
    on: vi.fn(),
    subscribe: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

vi.mock("../lib/api/client", () => ({
  apiRequest,
  PlanDeltaApiError: class PlanDeltaApiError extends Error {},
}));

vi.mock("../lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  }),
}));

import { AnalysisProgress } from "../components/analysis-progress";
import type { Analysis } from "../lib/api/contracts";

const activeAnalysis: Analysis = {
  id: "00000000-0000-4000-8000-000000000051",
  projectId: "00000000-0000-4000-8000-000000000052",
  baselineRevisionId: "00000000-0000-4000-8000-000000000053",
  candidateRevisionId: "00000000-0000-4000-8000-000000000054",
  status: "PREPROCESSING",
  cancellationRequested: false,
  progress: 5,
  currentStage: "vision_request",
  attemptCount: 1,
  maxAttempts: 3,
  startedAt: "2026-07-21T00:00:00.000Z",
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  schemaVersion: "1.0",
  engineVersion: "pending",
  configuration: { page: 1 },
  metrics: {},
  warnings: [],
  summaryProvider: "DETERMINISTIC",
  analysisProfile: "ENGINEERING_SCHEMATIC",
  profileVersion: "1.0",
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
};

describe("AnalysisProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      data: { session: { access_token: "safe-test-token" } },
    });
    channel.on.mockReturnThis();
    channel.subscribe.mockReturnThis();
    apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith("/cancel")
          ? {
              ...activeAnalysis,
              status: "PREPROCESSING",
              cancellationRequested: true,
              currentStage: "cancellation_requested",
            }
          : activeAnalysis,
      ),
    );
  });

  it("offers cancellation on the live progress screen and reflects the request", async () => {
    render(<AnalysisProgress initial={activeAnalysis} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/analyses/${activeAnalysis.id}/cancel`,
        "safe-test-token",
        expect.anything(),
        { method: "POST" },
      );
    });
    expect(await screen.findByRole("heading", { name: "Stopping analysis" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
  });

  it("explains a terminal cancellation and allows retry", () => {
    render(
      <AnalysisProgress
        initial={{
          ...activeAnalysis,
          status: "CANCELLED",
          cancellationRequested: true,
          currentStage: "cancelled",
          errorCode: "ANALYSIS_CANCELLED",
          errorMessage: "The analysis was cancelled.",
          completedAt: "2026-07-21T00:01:00.000Z",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Analysis cancelled" })).toBeVisible();
    expect(screen.getByText("No result was published.", { exact: false })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry analysis" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cancel analysis" })).not.toBeInTheDocument();
  });
});
