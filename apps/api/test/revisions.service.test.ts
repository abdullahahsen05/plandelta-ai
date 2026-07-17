import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../src/database/database.service.js";
import { RevisionsService } from "../src/revisions/revisions.service.js";
import type { ObjectStorage } from "../src/storage/storage.types.js";
import { expectApiError } from "./expect-api-error.js";

function databaseWithProject() {
  return {
    project: { findFirst: vi.fn().mockResolvedValue({ id: "project", status: "ACTIVE" }) },
    planRevision: {
      create: vi.fn((input: { data: Record<string, unknown> }) => Promise.resolve(input.data)),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { byteSize: 0n } }),
    },
  };
}

function storageMock() {
  const write = vi.fn().mockResolvedValue({ key: "stored", byteSize: 1 });
  return {
    provider: "LOCAL",
    write,
    read: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    deletePrefix: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn(),
    createReadReference: vi.fn(),
  } satisfies ObjectStorage;
}

async function pngFile(originalname = "sheet.png") {
  const buffer = await sharp({
    create: { width: 8, height: 6, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  return {
    buffer,
    size: buffer.byteLength,
    originalname,
    fieldname: "file",
    encoding: "7bit",
    mimetype: "application/octet-stream",
  } as Express.Multer.File;
}

describe("RevisionsService", () => {
  afterEach(() => {
    delete process.env.MAX_UPLOAD_BYTES;
    delete process.env.MAX_IMAGE_PIXELS;
  });

  it("inspects the real file signature and stores an owner-scoped generated key", async () => {
    const database = databaseWithProject();
    const storage = storageMock();
    const service = new RevisionsService(database as unknown as DatabaseService, storage);

    const result = await service.upload(
      "owner-a",
      "00000000-0000-4000-8000-000000000020",
      { label: "Candidate", role: "CANDIDATE", selectedPage: 1 },
      await pngFile(),
    );

    expect(storage.write).toHaveBeenCalledWith(
      expect.stringMatching(
        /^owner-a\/00000000-0000-4000-8000-000000000020\/[0-9a-f-]+\/original\.png$/,
      ),
      expect.any(Buffer),
    );
    expect(result).toMatchObject({ mimeType: "image/png", pageCount: 1, widthPx: 8, heightPx: 6 });
  });

  it("rejects a filename whose extension disagrees with the bytes", async () => {
    const database = databaseWithProject();
    const storage = storageMock();
    const service = new RevisionsService(database as unknown as DatabaseService, storage);

    await expectApiError(
      service.upload(
        "owner-a",
        "00000000-0000-4000-8000-000000000020",
        { label: "Candidate", role: "CANDIDATE" },
        await pngFile("sheet.pdf"),
      ),
      "UPLOAD_EXTENSION_MISMATCH",
      400,
    );
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("rejects upload before file inspection when project ownership fails", async () => {
    const database = databaseWithProject();
    database.project.findFirst.mockResolvedValue(null);
    const storage = storageMock();
    const service = new RevisionsService(database as unknown as DatabaseService, storage);

    await expectApiError(
      service.upload(
        "other-owner",
        "00000000-0000-4000-8000-000000000020",
        { label: "Candidate", role: "CANDIDATE" },
        await pngFile(),
      ),
      "PROJECT_NOT_FOUND",
      404,
    );
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("rejects an upload when the daily owner quota is exhausted", async () => {
    const database = databaseWithProject();
    database.planRevision.count.mockResolvedValue(40);
    const storage = storageMock();
    const service = new RevisionsService(database as unknown as DatabaseService, storage);

    await expectApiError(
      service.upload(
        "owner-a",
        "00000000-0000-4000-8000-000000000020",
        { label: "Candidate", role: "CANDIDATE" },
        await pngFile(),
      ),
      "UPLOAD_QUOTA_EXCEEDED",
      429,
    );
    expect(storage.write).not.toHaveBeenCalled();
  });
});
