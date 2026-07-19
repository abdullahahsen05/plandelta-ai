import { HttpStatus, Inject, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { decodeCursor, encodeCursor } from "../common/pagination.js";
import { DatabaseService } from "../database/database.service.js";
import { OBJECT_STORAGE, type ObjectStorage } from "../storage/storage.types.js";
import type { AnalysisListQueryDto, CreateAnalysisDto } from "./analysis.dto.js";

export const safeAnalysisSelect = {
  id: true,
  projectId: true,
  baselineRevisionId: true,
  candidateRevisionId: true,
  requestedBy: true,
  status: true,
  progress: true,
  currentStage: true,
  attemptCount: true,
  maxAttempts: true,
  startedAt: true,
  completedAt: true,
  errorCode: true,
  errorMessage: true,
  schemaVersion: true,
  engineVersion: true,
  configuration: true,
  metrics: true,
  warnings: true,
  summaryProvider: true,
  analysisProfile: true,
  profileVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AnalysesService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private async enforceAnalysisQuota(ownerId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recentCount, activeCount] = await Promise.all([
      this.database.analysis.count({
        where: { requestedBy: ownerId, createdAt: { gte: since } },
      }),
      this.database.analysis.count({
        where: {
          requestedBy: ownerId,
          status: {
            in: [
              "QUEUED",
              "CLAIMED",
              "PREPROCESSING",
              "ALIGNING",
              "DIFFING",
              "OCR",
              "CLASSIFYING",
              "SUMMARIZING",
              "RETRYING",
            ],
          },
        },
      }),
    ]);
    if (
      recentCount >= Number(process.env.MAX_ANALYSES_PER_HOUR ?? 12) ||
      activeCount >= Number(process.env.MAX_ACTIVE_ANALYSES ?? 3)
    ) {
      throw new ApiException(
        "ANALYSIS_QUOTA_EXCEEDED",
        "The analysis allowance has been reached. Wait for active work to finish.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async create(ownerId: string, projectId: string, input: CreateAnalysisDto) {
    if (input.baselineRevisionId === input.candidateRevisionId) {
      throw new ApiException(
        "REVISIONS_MUST_DIFFER",
        "Baseline and candidate revisions must differ.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const project = await this.database.project.findFirst({ where: { id: projectId, ownerId } });
    if (!project)
      throw new ApiException(
        "PROJECT_NOT_FOUND",
        "The project was not found.",
        HttpStatus.NOT_FOUND,
      );
    if (project.status === "ARCHIVED") {
      throw new ApiException(
        "PROJECT_ARCHIVED",
        "Archived projects cannot start analyses.",
        HttpStatus.CONFLICT,
      );
    }

    const revisions = await this.database.planRevision.findMany({
      where: {
        id: { in: [input.baselineRevisionId, input.candidateRevisionId] },
        projectId,
        uploadStatus: "READY",
      },
      select: { id: true, role: true, pageCount: true },
    });
    const baseline = revisions.find((revision) => revision.id === input.baselineRevisionId);
    const candidate = revisions.find((revision) => revision.id === input.candidateRevisionId);
    if (!baseline || !candidate || baseline.role !== "BASELINE" || candidate.role !== "CANDIDATE") {
      throw new ApiException(
        "REVISION_NOT_READY",
        "Both ready revisions must belong to the project and use baseline/candidate roles.",
        HttpStatus.CONFLICT,
      );
    }
    if (
      input.configuration.page > baseline.pageCount ||
      input.configuration.page > candidate.pageCount
    ) {
      throw new ApiException(
        "ANALYSIS_PAGE_INVALID",
        "The selected analysis page must exist in both revisions.",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.enforceAnalysisQuota(ownerId);

    return this.database.analysis.create({
      data: {
        projectId,
        baselineRevisionId: input.baselineRevisionId,
        candidateRevisionId: input.candidateRevisionId,
        requestedBy: ownerId,
        analysisProfile: project.analysisProfile,
        profileVersion: project.profileVersion,
        configuration: { ...input.configuration },
        maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS ?? 3),
      },
      select: safeAnalysisSelect,
    });
  }

  async list(ownerId: string, projectId: string, query: AnalysisListQueryDto) {
    const projectExists = await this.database.project.count({ where: { id: projectId, ownerId } });
    if (!projectExists)
      throw new ApiException(
        "PROJECT_NOT_FOUND",
        "The project was not found.",
        HttpStatus.NOT_FOUND,
      );
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (query.cursor && !cursor)
      throw new ApiException(
        "INVALID_CURSOR",
        "The analysis cursor is invalid.",
        HttpStatus.BAD_REQUEST,
      );
    const analyses = await this.database.analysis.findMany({
      where: {
        projectId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.timestamp) } },
                { createdAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: safeAnalysisSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const hasMore = analyses.length > query.limit;
    const items = hasMore ? analyses.slice(0, query.limit) : analyses;
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ timestamp: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async getOwned(ownerId: string, analysisId: string) {
    const analysis = await this.database.analysis.findFirst({
      where: { id: analysisId, project: { ownerId } },
      select: safeAnalysisSelect,
    });
    if (!analysis)
      throw new ApiException(
        "ANALYSIS_NOT_FOUND",
        "The analysis was not found.",
        HttpStatus.NOT_FOUND,
      );
    return analysis;
  }

  async retry(ownerId: string, analysisId: string) {
    const analysis = await this.getOwned(ownerId, analysisId);
    if (analysis.status !== "FAILED") {
      throw new ApiException(
        "ANALYSIS_NOT_RETRYABLE",
        "Only a failed analysis can be retried.",
        HttpStatus.CONFLICT,
      );
    }
    return this.database.analysis.update({
      where: { id: analysisId },
      data: {
        status: "QUEUED",
        progress: 0,
        currentStage: "queued",
        attemptCount: 0,
        nextAttemptAt: null,
        startedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        warnings: [],
      },
      select: safeAnalysisSelect,
    });
  }

  async delete(ownerId: string, analysisId: string) {
    await this.getOwned(ownerId, analysisId);
    const deleted = await this.database.analysis.deleteMany({
      where: { id: analysisId, status: { in: ["QUEUED", "RETRYING", "FAILED", "COMPLETED"] } },
    });
    if (deleted.count !== 1) {
      throw new ApiException(
        "ANALYSIS_ACTIVE",
        "An actively leased analysis cannot be deleted.",
        HttpStatus.CONFLICT,
      );
    }
    await this.storage.deletePrefix(`analyses/${analysisId}`);
  }
}
