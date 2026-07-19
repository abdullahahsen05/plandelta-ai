import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { decodeCursor, encodeCursor } from "../common/pagination.js";
import { DatabaseService } from "../database/database.service.js";
import type { CreateProjectDto, ProjectListQueryDto, UpdateProjectDto } from "./project.dto.js";

const projectSelect = {
  id: true,
  name: true,
  projectCode: true,
  description: true,
  status: true,
  analysisProfile: true,
  profileVersion: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { revisions: true, analyses: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService) {}

  create(ownerId: string, input: CreateProjectDto) {
    return this.database.project.create({
      data: {
        ownerId,
        name: input.name.trim(),
        projectCode: input.projectCode?.trim() || null,
        description: input.description?.trim() || null,
        analysisProfile: input.analysisProfile ?? "CONSTRUCTION_DRAWING",
        profileVersion: "1.0",
      },
      select: projectSelect,
    });
  }

  async list(ownerId: string, query: ProjectListQueryDto) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (query.cursor && !cursor) {
      throw new ApiException(
        "INVALID_CURSOR",
        "The project cursor is invalid.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const projects = await this.database.project.findMany({
      where: {
        ownerId,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: new Date(cursor.timestamp) } },
                { updatedAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: projectSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const hasMore = projects.length > query.limit;
    const items = hasMore ? projects.slice(0, query.limit) : projects;
    const last = items.at(-1);

    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ timestamp: last.updatedAt.toISOString(), id: last.id })
          : null,
    };
  }

  async getOwned(ownerId: string, projectId: string) {
    const project = await this.database.project.findFirst({
      where: { id: projectId, ownerId },
      select: {
        ...projectSelect,
        _count: { select: { revisions: true, analyses: true } },
      },
    });
    if (!project) {
      throw new ApiException(
        "PROJECT_NOT_FOUND",
        "The project was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    return project;
  }

  async update(ownerId: string, projectId: string, input: UpdateProjectDto) {
    const existing = await this.database.project.findFirst({
      where: { id: projectId, ownerId },
      select: {
        analysisProfile: true,
        _count: { select: { revisions: true, analyses: true, knowledgeDocuments: true } },
      },
    });
    if (!existing) {
      throw new ApiException(
        "PROJECT_NOT_FOUND",
        "The project was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      input.analysisProfile !== undefined &&
      input.analysisProfile !== existing.analysisProfile &&
      (existing._count.revisions > 0 ||
        existing._count.analyses > 0 ||
        existing._count.knowledgeDocuments > 0)
    ) {
      throw new ApiException(
        "ANALYSIS_PROFILE_LOCKED",
        "The analysis profile cannot change after drawings, analyses, or knowledge evidence exist.",
        HttpStatus.CONFLICT,
      );
    }
    return this.database.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.projectCode !== undefined
          ? { projectCode: input.projectCode.trim() || null }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.analysisProfile !== undefined
          ? { analysisProfile: input.analysisProfile, profileVersion: "1.0" }
          : {}),
      },
      select: projectSelect,
    });
  }

  async archive(ownerId: string, projectId: string) {
    await this.getOwned(ownerId, projectId);
    await this.database.project.update({
      where: { id: projectId },
      data: { status: "ARCHIVED" },
    });
  }
}
