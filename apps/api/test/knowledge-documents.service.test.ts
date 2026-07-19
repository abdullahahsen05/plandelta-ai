import { afterEach, describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../src/database/database.service.js";
import { KnowledgeDocumentsService } from "../src/knowledge/knowledge-documents.service.js";
import type { ObjectStorage } from "../src/storage/storage.types.js";
import { expectApiError } from "./expect-api-error.js";

const projectId = "00000000-0000-4000-8000-000000000020";
const ownerId = "00000000-0000-4000-8000-000000000021";

function textFile(
  originalname = "specification.txt",
  text = "SECTION 01 10 00\\nSummary of partition coordination requirements.",
): Express.Multer.File {
  const buffer = Buffer.from(text, "utf8");
  return {
    buffer,
    size: buffer.byteLength,
    originalname,
    fieldname: "file",
    encoding: "7bit",
    mimetype: "text/plain",
  } as Express.Multer.File;
}

function storageMock() {
  return {
    provider: "LOCAL",
    write: vi.fn().mockResolvedValue({ key: "stored", byteSize: 10 }),
    read: vi.fn().mockResolvedValue(Buffer.from("source")),
    delete: vi.fn().mockResolvedValue(undefined),
    deletePrefix: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    createReadReference: vi.fn(),
  } satisfies ObjectStorage;
}

function databaseMock() {
  const transaction = {
    knowledgeDocument: {
      create: vi.fn().mockResolvedValue({ id: "document" }),
      update: vi.fn().mockResolvedValue({ id: "document" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "document",
        status: "UPLOADED",
        ingestionJobs: [{ id: "job", status: "QUEUED" }],
      }),
    },
    knowledgeDocumentVersion: {
      create: vi.fn((input: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "version", input }),
      ),
    },
    ingestionJob: {
      create: vi.fn((input: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "job", input }),
      ),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit" }),
    },
  };
  return {
    project: {
      findFirst: vi.fn().mockResolvedValue({ id: projectId, status: "ACTIVE" }),
    },
    knowledgeDocument: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({ id: "document" }),
    },
    inTransaction: vi.fn(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
    transaction,
  };
}

describe("KnowledgeDocumentsService", () => {
  afterEach(() => {
    delete process.env.KNOWLEDGE_MAX_FILE_BYTES;
    delete process.env.KNOWLEDGE_MAX_PAGES;
  });

  it("stores a validated owner-scoped document and queues its typed version", async () => {
    const database = databaseMock();
    const storage = storageMock();
    const service = new KnowledgeDocumentsService(
      database as unknown as DatabaseService,
      storage,
    );

    const result = await service.upload(
      ownerId,
      projectId,
      {
        documentType: "SPECIFICATION",
        revisionLabel: "Issued for coordination",
        effectiveDate: "2026-07-19",
      },
      textFile(),
    );

    expect(storage.write).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^${ownerId}/${projectId}/knowledge/[0-9a-f-]+/original\\.txt$`),
      ),
      expect.any(Buffer),
    );
    const versionInput =
      database.transaction.knowledgeDocumentVersion.create.mock.calls[0]?.[0].data;
    expect(versionInput).toMatchObject({
      projectId,
      revisionLabel: "Issued for coordination",
      pageCount: 1,
      parserName: "utf8",
      embeddingProvider: "local",
      embeddingDimension: 384,
    });
    expect(typeof versionInput?.documentId).toBe("string");
    const jobInput = database.transaction.ingestionJob.create.mock.calls[0]?.[0].data;
    expect(jobInput).toMatchObject({
      projectId,
      status: "QUEUED",
    });
    expect(typeof jobInput?.documentId).toBe("string");
    expect(typeof jobInput?.documentVersionId).toBe("string");
    expect(result).toMatchObject({ status: "UPLOADED" });
  });

  it("rejects invalid UTF-8 before storing anything", async () => {
    const database = databaseMock();
    const storage = storageMock();
    const service = new KnowledgeDocumentsService(
      database as unknown as DatabaseService,
      storage,
    );
    const invalid = textFile("specification.txt");
    invalid.buffer = Buffer.from([0xc3, 0x28]);
    invalid.size = invalid.buffer.byteLength;

    await expectApiError(
      service.upload(ownerId, projectId, { documentType: "SPECIFICATION" }, invalid),
      "KNOWLEDGE_DOCUMENT_INVALID",
      400,
    );
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("checks ownership before inspecting or storing a document", async () => {
    const database = databaseMock();
    database.project.findFirst.mockResolvedValue(null);
    const storage = storageMock();
    const service = new KnowledgeDocumentsService(
      database as unknown as DatabaseService,
      storage,
    );

    await expectApiError(
      service.upload(ownerId, projectId, { documentType: "SPECIFICATION" }, textFile()),
      "PROJECT_NOT_FOUND",
      404,
    );
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("does not retry a queued ingestion", async () => {
    const database = databaseMock();
    database.knowledgeDocument.findFirst.mockResolvedValue({
      id: "document",
      status: "UPLOADED",
      ingestionJobs: [
        {
          id: "job",
          documentVersionId: "00000000-0000-4000-8000-000000000030",
          status: "QUEUED",
        },
      ],
    });
    const service = new KnowledgeDocumentsService(
      database as unknown as DatabaseService,
      storageMock(),
    );

    await expectApiError(
      service.retry(ownerId, projectId, "00000000-0000-4000-8000-000000000031"),
      "KNOWLEDGE_RETRY_NOT_ALLOWED",
      409,
    );
  });
});
