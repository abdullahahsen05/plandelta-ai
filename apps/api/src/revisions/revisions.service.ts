import { createHash, randomUUID } from "node:crypto";
import { basename, extname } from "node:path";

import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { fileTypeFromBuffer } from "file-type";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";
import { OBJECT_STORAGE, type ObjectStorage } from "../storage/storage.types.js";
import type { UpdateRevisionDto, UploadRevisionDto } from "./revision.dto.js";

const revisionSelect = {
  id: true,
  projectId: true,
  label: true,
  revisionCode: true,
  role: true,
  originalName: true,
  mimeType: true,
  byteSize: true,
  pageCount: true,
  selectedPage: true,
  widthPx: true,
  heightPx: true,
  uploadStatus: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

type InspectedFile = {
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  extension: "pdf" | "jpg" | "png";
  pageCount: number;
  widthPx: number | null;
  heightPx: number | null;
};

function safeOriginalName(value: string) {
  return Array.from(basename(value))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .slice(0, 255);
}

@Injectable()
export class RevisionsService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private async enforceUploadQuota(ownerId: string, incomingBytes: number) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [uploadCount, byteUsage] = await Promise.all([
      this.database.planRevision.count({
        where: { project: { ownerId }, createdAt: { gte: since } },
      }),
      this.database.planRevision.aggregate({
        where: { project: { ownerId }, createdAt: { gte: since } },
        _sum: { byteSize: true },
      }),
    ]);
    const maxUploads = Number(process.env.MAX_UPLOADS_PER_DAY ?? 40);
    const maxBytes = BigInt(process.env.MAX_UPLOAD_BYTES_PER_DAY ?? 500 * 1024 * 1024);
    const usedBytes = byteUsage._sum.byteSize ?? 0n;
    if (uploadCount >= maxUploads || usedBytes + BigInt(incomingBytes) > maxBytes) {
      throw new ApiException(
        "UPLOAD_QUOTA_EXCEEDED",
        "The daily drawing upload allowance has been reached. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async requireOwnedProject(ownerId: string, projectId: string) {
    const project = await this.database.project.findFirst({ where: { id: projectId, ownerId } });
    if (!project) {
      throw new ApiException(
        "PROJECT_NOT_FOUND",
        "The project was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (project.status === "ARCHIVED") {
      throw new ApiException(
        "PROJECT_ARCHIVED",
        "Archived projects cannot accept revisions.",
        HttpStatus.CONFLICT,
      );
    }
  }

  private async inspectFile(file: Express.Multer.File): Promise<InspectedFile> {
    const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024);
    if (!file.buffer?.length || file.size <= 0 || file.size > maxBytes) {
      throw new ApiException(
        "UPLOAD_SIZE_INVALID",
        `The drawing must be between 1 byte and ${maxBytes} bytes.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    const allowed = new Map([
      ["application/pdf", { mimeType: "application/pdf" as const, extension: "pdf" as const }],
      ["image/png", { mimeType: "image/png" as const, extension: "png" as const }],
      ["image/jpeg", { mimeType: "image/jpeg" as const, extension: "jpg" as const }],
    ]);
    const kind = detected ? allowed.get(detected.mime) : undefined;
    if (!kind) {
      throw new ApiException(
        "UPLOAD_TYPE_UNSUPPORTED",
        "The drawing signature must be PDF, PNG, JPG, or JPEG.",
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const submittedExtension = extname(file.originalname).toLowerCase();
    const validExtensions = kind.extension === "jpg" ? [".jpg", ".jpeg"] : [`.${kind.extension}`];
    if (!validExtensions.includes(submittedExtension)) {
      throw new ApiException(
        "UPLOAD_EXTENSION_MISMATCH",
        "The filename extension does not match the file signature.",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (kind.mimeType === "application/pdf") {
      let pageCount: number;
      try {
        const document = await PDFDocument.load(file.buffer, { updateMetadata: false });
        pageCount = document.getPageCount();
      } catch {
        throw new ApiException(
          "PDF_INVALID",
          "The PDF could not be read or is encrypted.",
          HttpStatus.BAD_REQUEST,
        );
      }
      const maxPages = Number(process.env.MAX_PDF_PAGES ?? 50);
      if (pageCount < 1 || pageCount > maxPages) {
        throw new ApiException(
          "PDF_PAGE_LIMIT",
          `The PDF must contain between 1 and ${maxPages} pages.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return { ...kind, pageCount, widthPx: null, heightPx: null };
    }

    const metadata = await sharp(file.buffer, {
      limitInputPixels: Number(process.env.MAX_IMAGE_PIXELS ?? 60_000_000),
    }).metadata();
    if (!metadata.width || !metadata.height) {
      throw new ApiException(
        "IMAGE_INVALID",
        "The image dimensions could not be read.",
        HttpStatus.BAD_REQUEST,
      );
    }
    return { ...kind, pageCount: 1, widthPx: metadata.width, heightPx: metadata.height };
  }

  async upload(
    ownerId: string,
    projectId: string,
    input: UploadRevisionDto,
    file?: Express.Multer.File,
  ) {
    await this.requireOwnedProject(ownerId, projectId);
    if (!file) {
      throw new ApiException(
        "UPLOAD_REQUIRED",
        "A drawing file is required.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const inspected = await this.inspectFile(file);
    await this.enforceUploadQuota(ownerId, file.size);
    const selectedPage = input.selectedPage ?? 1;
    if (selectedPage > inspected.pageCount) {
      throw new ApiException(
        "SELECTED_PAGE_INVALID",
        "The selected page is outside the uploaded drawing.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const revisionId = randomUUID();
    const storageKey = `${ownerId}/${projectId}/${revisionId}/original.${inspected.extension}`;
    await this.storage.write(storageKey, file.buffer);
    try {
      return await this.database.planRevision.create({
        data: {
          id: revisionId,
          projectId,
          label: input.label.trim(),
          revisionCode: input.revisionCode?.trim() || null,
          role: input.role,
          originalName: safeOriginalName(file.originalname),
          mimeType: inspected.mimeType,
          byteSize: BigInt(file.size),
          checksumSha256: createHash("sha256").update(file.buffer).digest("hex"),
          storageProvider: this.storage.provider,
          storageKey,
          pageCount: inspected.pageCount,
          selectedPage,
          widthPx: inspected.widthPx,
          heightPx: inspected.heightPx,
          uploadStatus: "READY",
          metadata: { detectedExtension: inspected.extension },
        },
        select: revisionSelect,
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  list(ownerId: string, projectId: string) {
    return this.database.planRevision.findMany({
      where: { projectId, project: { ownerId } },
      select: revisionSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async getOwned(ownerId: string, revisionId: string, includeStorageKey = false) {
    const revision = await this.database.planRevision.findFirst({
      where: { id: revisionId, project: { ownerId } },
      select: { ...revisionSelect, ...(includeStorageKey ? { storageKey: true } : {}) },
    });
    if (!revision) {
      throw new ApiException(
        "REVISION_NOT_FOUND",
        "The revision was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    return revision;
  }

  async update(ownerId: string, revisionId: string, input: UpdateRevisionDto) {
    const revision = await this.getOwned(ownerId, revisionId);
    if (input.selectedPage && input.selectedPage > revision.pageCount) {
      throw new ApiException(
        "SELECTED_PAGE_INVALID",
        "The selected page is outside the uploaded drawing.",
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.database.planRevision.update({
      where: { id: revisionId },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.revisionCode !== undefined
          ? { revisionCode: input.revisionCode.trim() || null }
          : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.selectedPage !== undefined ? { selectedPage: input.selectedPage } : {}),
      },
      select: revisionSelect,
    });
  }

  async delete(ownerId: string, revisionId: string) {
    const revision = await this.getOwned(ownerId, revisionId, true);
    if (!("storageKey" in revision)) throw new Error("Storage key was not selected.");
    const analysisCount = await this.database.analysis.count({
      where: { OR: [{ baselineRevisionId: revisionId }, { candidateRevisionId: revisionId }] },
    });
    if (analysisCount > 0) {
      throw new ApiException(
        "REVISION_IN_USE",
        "A revision used by an analysis cannot be deleted.",
        HttpStatus.CONFLICT,
      );
    }
    await this.database.planRevision.delete({ where: { id: revisionId } });
    await this.storage.delete(revision.storageKey);
  }

  async preview(ownerId: string, revisionId: string) {
    const revision = await this.getOwned(ownerId, revisionId, true);
    if (!("storageKey" in revision)) throw new Error("Storage key was not selected.");
    return { revision, bytes: await this.storage.read(revision.storageKey) };
  }
}
