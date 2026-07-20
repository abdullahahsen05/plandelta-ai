import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../src/database/database.service.js";
import { JobQueueService } from "../src/worker/job-queue.service.js";

const analysisId = "00000000-0000-4000-8000-000000000041";

describe("JobQueueService cancellation", () => {
  it("terminalizes a cancellation instead of scheduling another retry", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      analysis: {
        findUnique: vi.fn().mockResolvedValue({
          attemptCount: 1,
          maxAttempts: 3,
          cancellationRequested: true,
        }),
        updateMany,
      },
    };
    const queue = new JobQueueService(database as unknown as DatabaseService);

    await queue.fail(analysisId, "worker-1", new DOMException("Aborted", "AbortError"));

    expect(updateMany).toHaveBeenCalledTimes(1);
    const updateInput = updateMany.mock.calls[0]?.[0] as {
      where: { id: string; leaseOwner: string };
      data: {
        status: string;
        currentStage: string;
        nextAttemptAt: Date | null;
        errorCode: string;
      };
    };
    expect(updateInput.where).toEqual({ id: analysisId, leaseOwner: "worker-1" });
    expect(updateInput.data).toMatchObject({
      status: "CANCELLED",
      currentStage: "cancelled",
      nextAttemptAt: null,
      errorCode: "ANALYSIS_CANCELLED",
    });
  });

  it("will not advance an analysis after cancellation is requested", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const queue = new JobQueueService({
      analysis: { updateMany },
    } as unknown as DatabaseService);

    await expect(
      queue.advance(analysisId, "worker-1", "SUMMARIZING", "summary", 90),
    ).rejects.toThrow("Analysis lease ownership was lost.");
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: analysisId,
        leaseOwner: "worker-1",
        cancellationRequested: false,
      },
      data: {
        status: "SUMMARIZING",
        currentStage: "summary",
        progress: 90,
      },
    });
  });
});
