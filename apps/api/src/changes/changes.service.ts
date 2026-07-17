import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";
import type { ChangeListQueryDto } from "./change-query.dto.js";

@Injectable()
export class ChangesService {
  constructor(private readonly database: DatabaseService) {}

  async list(ownerId: string, analysisId: string, query: ChangeListQueryDto) {
    const owned = await this.database.analysis.count({
      where: { id: analysisId, project: { ownerId } },
    });
    if (!owned)
      throw new ApiException(
        "ANALYSIS_NOT_FOUND",
        "The analysis was not found.",
        HttpStatus.NOT_FOUND,
      );

    const changes = await this.database.detectedChange.findMany({
      where: {
        analysisId,
        ...(query.type ? { changeType: query.type } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.minimumConfidence !== undefined
          ? { confidence: { gte: query.minimumConfidence } }
          : {}),
        ...(query.affectedTrade ? { affectedTrades: { has: query.affectedTrade } } : {}),
        ...(query.cursor !== undefined ? { sequence: { gt: query.cursor } } : {}),
      },
      orderBy: { sequence: "asc" },
      take: query.limit + 1,
    });
    const hasMore = changes.length > query.limit;
    const items = hasMore ? changes.slice(0, query.limit) : changes;
    return { items, nextCursor: hasMore ? (items.at(-1)?.sequence ?? null) : null };
  }
}
