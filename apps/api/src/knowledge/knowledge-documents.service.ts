import { createHash, randomUUID } from "node:crypto";
import { basename, extname } from "node:path";

import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { fileTypeFromBuffer } from "file-type";
import { PDFDocument } from "pdf-lib";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";
import { OBJECT_STORAGE, type ObjectStorage } from "../storage/storage.types.js";
import type { UploadKnowledgeDocumentDto } from "./knowledge-document.dto.js";

const documentSelect = {
  id: true,
  projectId: true,
  originalName: true,
  detectedMimeType: true,
  byteSize: true,
  checksumSha256: true,
  documentType: true,
  status: true,
  failureCode: true,
  createdAt: true,
  updatedAt: true,
  activeVersion: {
    select: {
      id: true,
      revisionLabel: true,
      effectiveDate: true,
      pageCount: true,
      extractedCharacterCount: true,
      parserName: true,
      parserVersion: true,
      chunkerVersion: true,
      embeddingProvider: true,
      embeddingModel: true,
      embeddingDimension: true,
      status: true,
      completedAt: true,
    },
  },
  ingestionJobs: {
    select: {
      id: true,
      documentVersionId: true,
      status: true,
      progress: true,
      currentStage: true,
      attemptCount: true,
      maxAttempts: true,
      failureCode: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

type InspectedKnowledgeFile = {
  mimeType: "application/pdf" | "text/plain";
  extension: "pdf" | "txt";
  pageCount: number;
};

function safeOriginalName(value: string): string {
  return Array.from(basename(value))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .slice(0, 255);
}

@Injectable()
export class KnowledgeDocumentsService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async upload(
    ownerId: string,
    projectId: string,
    input: UploadKnowledgeDocumentDto,
    file?: Express.Multer.File,
  ) {
    await this.requireOwnedProject(ownerId, projectId);
    if (!file) {
      throw new ApiException(
        "KNOWLEDGE_DOCUMENT_REQUIRED",
        "A supporting document is required.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const inspected = await this.inspectFile(file);
    const documentId = randomUUID();
    const versionId = randomUUID();
    const originalName = safeOriginalName(file.originalname);
    if (!originalName) {
      throw new ApiException(
        "KNOWLEDGE_DOCUMENT_FILENAME_INVALID",
        "The supporting document filename is invalid.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const storageKey = `${ownerId}/${projectId}/knowledge/${documentId}/original.${inspected.extension}`;
    const checksumSha256 = createHash("sha256").update(file.buffer).digest("hex");
    await this.storage.write(storageKey, file.buffer);
    try {
      return await this.database.inTransaction(async (transaction) => {
        await transaction.knowledgeDocument.create({
          data: {
            id: documentId,
            projectId,
            ownerId,
            originalName,
            detectedMimeType: inspected.mimeType,
            byteSize: BigInt(file.size),
            checksumSha256,
            storageProvider: this.storage.provider,
            storageKey,
            documentType: input.documentType,
            status: "UPLOADED",
          },
        });
        await transaction.knowledgeDocumentVersion.create({
          data: {
            id: versionId,
            documentId,
            projectId,
            revisionLabel: input.revisionLabel?.trim() || null,
            effectiveDate: input.effectiveDate
              ? new Date(`${input.effectiveDate}T00:00:00.000Z`)
              : null,
            checksumSha256,
            pageCount: inspected.pageCount,
            parserName: inspected.mimeType === "application/pdf" ? "pypdf" : "utf8",
            parserVersion: inspected.mimeType === "application/pdf" ? "6" : "1",
            chunkerVersion: "plandelta-structure-v1",
            embeddingProvider: "local",
            embeddingModel: process.env.AGENT_EMBEDDING_MODEL ?? "BAAI/bge-small-en-v1.5",
            embeddingDimension: Number(process.env.AGENT_EMBEDDING_DIMENSION ?? 384),
            status: "PENDING",
            isActive: false,
          },
        });
        await transaction.ingestionJob.create({
          data: {
            documentId,
            documentVersionId: versionId,
            projectId,
            idempotencyKey: randomUUID(),
            status: "QUEUED",
            progress: 0,
            currentStage: "queued",
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorId: ownerId,
            projectId,
            eventType: "KNOWLEDGE_DOCUMENT_UPLOADED",
            correlationId: randomUUID(),
            metadata: {
              documentId,
              documentType: input.documentType,
              detectedMimeType: inspected.mimeType,
              pageCount: inspected.pageCount,
              hasRevisionLabel: Boolean(input.revisionLabel),
              hasEffectiveDate: Boolean(input.effectiveDate),
            },
          },
        });
        return transaction.knowledgeDocument.findUniqueOrThrow({
          where: { id: documentId },
          select: documentSelect,
        });
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async list(ownerId: string, projectId: string) {
    await this.requireOwnedProject(ownerId, projectId, true);
    return this.database.knowledgeDocument.findMany({
      where: { projectId, ownerId, deletedAt: null },
      select: documentSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async getOwned(ownerId: string, projectId: string, documentId: string, withStorage = false) {
    const document = await this.database.knowledgeDocument.findFirst({
      where: { id: documentId, projectId, ownerId, deletedAt: null },
      select: {
        ...documentSelect,
        ...(withStorage ? { storageKey: true, storageProvider: true } : {}),
      },
    });
    if (!document) {
      throw new ApiException(
        "KNOWLEDGE_DOCUMENT_NOT_FOUND",
        "The supporting document was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    return document;
  }

  async retry(ownerId: string, projectId: string, documentId: string) {
    const document = await this.getOwned(ownerId, projectId, documentId);
    const latestJob = document.ingestionJobs[0];
    if (
      document.status !== "FAILED" &&
      latestJob &&
      !["FAILED", "CANCELLED"].includes(latestJob.status)
    ) {
      throw new ApiException(
        "KNOWLEDGE_RETRY_NOT_ALLOWED",
        "Only a failed or cancelled ingestion can be retried.",
        HttpStatus.CONFLICT,
      );
    }
    if (!latestJob?.documentVersionId) {
      throw new ApiException(
        "KNOWLEDGE_RETRY_NOT_ALLOWED",
        "The failed ingestion has no reusable document version.",
        HttpStatus.CONFLICT,
      );
    }
    await this.database.inTransaction(async (transaction) => {
      await transaction.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "UPLOADED", failureCode: null },
      });
      await transaction.ingestionJob.create({
        data: {
          documentId,
          documentVersionId: latestJob.documentVersionId,
          projectId,
          idempotencyKey: randomUUID(),
          status: "QUEUED",
          progress: 0,
          currentStage: "queued",
        },
      });
    });
    return this.getOwned(ownerId, projectId, documentId);
  }

  async delete(ownerId: string, projectId: string, documentId: string): Promise<void> {
    const document = await this.getOwned(ownerId, projectId, documentId, true);
    if (!("storageKey" in document)) throw new Error("Storage key was not selected.");
    await this.database.knowledgeDocument.delete({ where: { id: documentId } });
    await this.storage.delete(document.storageKey);
  }

  async source(ownerId: string, projectId: string, documentId: string) {
    const document = await this.getOwned(ownerId, projectId, documentId, true);
    if (!("storageKey" in document)) throw new Error("Storage key was not selected.");
    return {
      document,
      bytes: await this.storage.read(document.storageKey),
    };
  }

  private async requireOwnedProject(ownerId: string, projectId: string, allowArchived = false) {
    const project = await this.database.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true, status: true },
    });
    if (!project) {
      throw new ApiException(
        "PROJECT_NOT_FOUND",
        "The project was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (!allowArchived && project.status === "ARCHIVED") {
      throw new ApiException(
        "PROJECT_ARCHIVED",
        "Archived projects cannot accept supporting documents.",
        HttpStatus.CONFLICT,
      );
    }
  }

  private async inspectFile(file: Express.Multer.File): Promise<InspectedKnowledgeFile> {
    const maxBytes = Number(process.env.KNOWLEDGE_MAX_FILE_BYTES ?? 20 * 1024 * 1024);
    if (!file.buffer?.length || file.size <= 0 || file.size > maxBytes) {
      throw new ApiException(
        "KNOWLEDGE_DOCUMENT_SIZE_INVALID",
        `The supporting document must be between 1 byte and ${maxBytes} bytes.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const extension = extname(file.originalname).toLowerCase();
    const detected = await fileTypeFromBuffer(file.buffer);
    if (detected?.mime === "application/pdf") {
      if (extension !== ".pdf") {
        throw new ApiException(
          "KNOWLEDGE_DOCUMENT_EXTENSION_MISMATCH",
          "The filename extension does not match the file signature.",
          HttpStatus.BAD_REQUEST,
        );
      }
      let pageCount: number;
      try {
        pageCount = (await PDFDocument.load(file.buffer, { updateMetadata: false })).getPageCount();
      } catch {
        throw new ApiException(
          "KNOWLEDGE_DOCUMENT_INVALID",
          "The PDF could not be read or is encrypted.",
          HttpStatus.BAD_REQUEST,
        );
      }
      const maxPages = Number(process.env.KNOWLEDGE_MAX_PAGES ?? 100);
      if (pageCount < 1 || pageCount > maxPages) {
        throw new ApiException(
          "KNOWLEDGE_DOCUMENT_PAGE_LIMIT",
          `The supporting PDF must contain between 1 and ${maxPages} pages.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return { mimeType: "application/pdf", extension: "pdf", pageCount };
    }

    if (!detected && extension === ".txt") {
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
        if (!text.trim() || text.includes("\u0000")) throw new Error("Invalid text.");
      } catch {
        throw new ApiException(
          "KNOWLEDGE_DOCUMENT_INVALID",
          "The text document must contain valid UTF-8 text.",
          HttpStatus.BAD_REQUEST,
        );
      }
      return { mimeType: "text/plain", extension: "txt", pageCount: 1 };
    }

    throw new ApiException(
      "KNOWLEDGE_DOCUMENT_UNSUPPORTED",
      "Supporting documents must be PDF or UTF-8 TXT files.",
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
}
