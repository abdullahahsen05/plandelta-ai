import { describe, expect, it, vi } from "vitest";

import { AnalysesService } from "../src/analyses/analyses.service.js";
import type { DatabaseService } from "../src/database/database.service.js";
import { expectApiError } from "./expect-api-error.js";

const baselineId = "00000000-0000-4000-8000-000000000031";
const candidateId = "00000000-0000-4000-8000-000000000032";
const projectId = "00000000-0000-4000-8000-000000000030";
const analysisId = "00000000-0000-4000-8000-000000000033";
const storage = {
  provider: "LOCAL" as const,
  write: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
  deletePrefix: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn(),
  createReadReference: vi.fn(),
};

describe("AnalysesService", () => {
  it("rejects identical revision IDs without touching the database", async () => {
    const projectFindFirst = vi.fn();
    const service = new AnalysesService(
      {
        project: { findFirst: projectFindFirst },
      } as unknown as DatabaseService,
      storage,
    );

    await expectApiError(
      service.create("owner-a", projectId, {
        baselineRevisionId: baselineId,
        candidateRevisionId: baselineId,
        configuration: { page: 1, sensitivity: "balanced", ocrEnabled: true, classifier: "auto" },
      }),
      "REVISIONS_MUST_DIFFER",
      400,
    );
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("queues only a ready baseline/candidate pair from the owned project", async () => {
    const create = vi.fn().mockResolvedValue({ id: "analysis", status: "QUEUED" });
    const database = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: projectId,
          status: "ACTIVE",
          analysisProfile: "ENGINEERING_SCHEMATIC",
          profileVersion: "1.0",
        }),
      },
      planRevision: {
        findMany: vi.fn().mockResolvedValue([
          { id: baselineId, role: "BASELINE", pageCount: 2 },
          { id: candidateId, role: "CANDIDATE", pageCount: 2 },
        ]),
      },
      analysis: { create, count: vi.fn().mockResolvedValue(0) },
    };
    const service = new AnalysesService(database as unknown as DatabaseService, storage);

    await expect(
      service.create("owner-a", projectId, {
        baselineRevisionId: baselineId,
        candidateRevisionId: candidateId,
        configuration: { page: 2, sensitivity: "balanced", ocrEnabled: true, classifier: "auto" },
      }),
    ).resolves.toMatchObject({ status: "QUEUED" });
    const revisionQuery = database.planRevision.findMany.mock.calls[0]?.[0] as {
      where: { projectId: string; uploadStatus: string };
    };
    expect(revisionQuery.where).toMatchObject({ projectId, uploadStatus: "READY" });
    const createInput = create.mock.calls[0]?.[0] as {
      data: { projectId: string; requestedBy: string };
    };
    expect(createInput.data).toMatchObject({
      projectId,
      requestedBy: "owner-a",
      analysisProfile: "ENGINEERING_SCHEMATIC",
      profileVersion: "1.0",
    });
  });

  it("rejects analysis creation when active work reaches the owner quota", async () => {
    const database = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: projectId, status: "ACTIVE" }) },
      planRevision: {
        findMany: vi.fn().mockResolvedValue([
          { id: baselineId, role: "BASELINE", pageCount: 1 },
          { id: candidateId, role: "CANDIDATE", pageCount: 1 },
        ]),
      },
      analysis: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(3),
        create: vi.fn(),
      },
    };
    const service = new AnalysesService(database as unknown as DatabaseService, storage);

    await expectApiError(
      service.create("owner-a", projectId, {
        baselineRevisionId: baselineId,
        candidateRevisionId: candidateId,
        configuration: { page: 1, sensitivity: "balanced", ocrEnabled: true, classifier: "auto" },
      }),
      "ANALYSIS_QUOTA_EXCEEDED",
      429,
    );
    expect(database.analysis.create).not.toHaveBeenCalled();
  });

  it("requests cooperative cancellation for an active analysis", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      analysis: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: analysisId,
            projectId,
            status: "PREPROCESSING",
            cancellationRequested: false,
          })
          .mockResolvedValueOnce({
            id: analysisId,
            projectId,
            status: "PREPROCESSING",
            cancellationRequested: true,
            currentStage: "cancellation_requested",
          }),
        updateMany,
      },
    };
    const service = new AnalysesService(database as unknown as DatabaseService, storage);

    await expect(service.cancel("owner-a", analysisId)).resolves.toMatchObject({
      cancellationRequested: true,
      currentStage: "cancellation_requested",
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          cancellationRequested: true,
          currentStage: "cancellation_requested",
        },
      }),
    );
  });

  it("cancels queued work immediately without leaving a lease", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      analysis: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: analysisId,
            projectId,
            status: "QUEUED",
            cancellationRequested: false,
          })
          .mockResolvedValueOnce({
            id: analysisId,
            projectId,
            status: "CANCELLED",
            cancellationRequested: true,
          }),
        updateMany,
      },
    };
    const service = new AnalysesService(database as unknown as DatabaseService, storage);

    await expect(service.cancel("owner-a", analysisId)).resolves.toMatchObject({
      status: "CANCELLED",
    });
    const cancelInput = updateMany.mock.calls[0]?.[0] as {
      data: {
        status: string;
        cancellationRequested: boolean;
        leaseOwner: string | null;
        errorCode: string;
      };
    };
    expect(cancelInput.data).toMatchObject({
      status: "CANCELLED",
      cancellationRequested: true,
      leaseOwner: null,
      errorCode: "ANALYSIS_CANCELLED",
    });
  });

  it("still cancels when a queued analysis is claimed during the request", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const database = {
      analysis: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: analysisId,
            projectId,
            status: "QUEUED",
            cancellationRequested: false,
          })
          .mockResolvedValueOnce({
            id: analysisId,
            projectId,
            status: "CLAIMED",
            cancellationRequested: true,
            currentStage: "cancellation_requested",
          }),
        updateMany,
      },
    };
    const service = new AnalysesService(database as unknown as DatabaseService, storage);

    await expect(service.cancel("owner-a", analysisId)).resolves.toMatchObject({
      cancellationRequested: true,
      currentStage: "cancellation_requested",
    });
    expect(updateMany).toHaveBeenCalledTimes(2);
    const fallbackInput = updateMany.mock.calls[1]?.[0] as {
      data: { cancellationRequested: boolean; currentStage: string };
    };
    expect(fallbackInput.data).toEqual({
      cancellationRequested: true,
      currentStage: "cancellation_requested",
    });
  });

  it("resets cancellation state when a cancelled analysis is retried", async () => {
    const update = vi.fn().mockResolvedValue({
      id: analysisId,
      status: "QUEUED",
      cancellationRequested: false,
    });
    const database = {
      analysis: {
        findFirst: vi.fn().mockResolvedValue({
          id: analysisId,
          projectId,
          status: "CANCELLED",
          cancellationRequested: true,
        }),
        update,
      },
    };
    const service = new AnalysesService(database as unknown as DatabaseService, storage);

    await expect(service.retry("owner-a", analysisId)).resolves.toMatchObject({
      status: "QUEUED",
      cancellationRequested: false,
    });
    const retryInput = update.mock.calls[0]?.[0] as {
      data: {
        status: string;
        cancellationRequested: boolean;
        errorCode: string | null;
      };
    };
    expect(retryInput.data).toMatchObject({
      status: "QUEUED",
      cancellationRequested: false,
      errorCode: null,
    });
  });
});
