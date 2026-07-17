import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../src/database/database.service.js";
import { ProjectsService } from "../src/projects/projects.service.js";
import { expectApiError } from "./expect-api-error.js";

describe("ProjectsService", () => {
  it("always scopes project reads to the authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new ProjectsService({ project: { findFirst } } as unknown as DatabaseService);

    await expectApiError(
      service.getOwned("owner-a", "00000000-0000-4000-8000-000000000010"),
      "PROJECT_NOT_FOUND",
      404,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "00000000-0000-4000-8000-000000000010", ownerId: "owner-a" },
      }),
    );
  });

  it("rejects malformed pagination cursors before querying", async () => {
    const findMany = vi.fn();
    const service = new ProjectsService({ project: { findMany } } as unknown as DatabaseService);

    await expectApiError(
      service.list("owner-a", { cursor: "not-a-cursor", limit: 20 }),
      "INVALID_CURSOR",
      400,
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
