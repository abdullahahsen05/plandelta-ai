import { describe, expect, it, vi } from "vitest";

import { AnalysesService } from "../src/analyses/analyses.service.js";
import type { DatabaseService } from "../src/database/database.service.js";
import { expectApiError } from "./expect-api-error.js";

const baselineId = "00000000-0000-4000-8000-000000000031";
const candidateId = "00000000-0000-4000-8000-000000000032";
const projectId = "00000000-0000-4000-8000-000000000030";
const storage = {
  write: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
  deletePrefix: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn(),
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
      project: { findFirst: vi.fn().mockResolvedValue({ id: projectId, status: "ACTIVE" }) },
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
    expect(createInput.data).toMatchObject({ projectId, requestedBy: "owner-a" });
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
});
