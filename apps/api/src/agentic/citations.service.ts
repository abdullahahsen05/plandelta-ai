import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class CitationsService {
  constructor(private readonly database: DatabaseService) {}

  async listForMessage(ownerId: string, messageId: string) {
    const message = await this.database.message.findFirst({
      where: { id: messageId, conversation: { ownerId } },
      select: { id: true },
    });
    if (!message) this.notFound();
    return this.database.citation.findMany({
      where: { messageId },
      select: {
        id: true,
        displayOrder: true,
        citationType: true,
        label: true,
        supportsClaimIds: true,
        analysisId: true,
        detectedChangeId: true,
        artifactId: true,
        normalizedRegion: true,
        knowledgeDocumentId: true,
        knowledgeVersionId: true,
        knowledgeChunkId: true,
        pageNumber: true,
        sectionTitle: true,
        excerpt: true,
        verifiedAt: true,
      },
      orderBy: { displayOrder: "asc" },
    });
  }

  async source(ownerId: string, citationId: string) {
    const citation = await this.database.citation.findFirst({
      where: { id: citationId, project: { ownerId } },
      include: {
        detectedChange: { select: { id: true, sequence: true } },
        knowledgeDocument: {
          select: { id: true, originalName: true, status: true, activeVersionId: true },
        },
        knowledgeVersion: { select: { id: true, revisionLabel: true, effectiveDate: true } },
        knowledgeChunk: {
          select: { id: true, pageNumber: true, sectionTitle: true, excerpt: true },
        },
      },
    });
    if (!citation) this.notFound();
    if (citation.citationType === "VISUAL_CHANGE") {
      return {
        type: "visual_change",
        analysisId: citation.analysisId,
        changeId: citation.detectedChangeId,
        changeSequence: citation.detectedChange?.sequence ?? null,
        artifactId: citation.artifactId,
        region: citation.normalizedRegion,
      };
    }
    return {
      type: "document_chunk",
      documentId: citation.knowledgeDocumentId,
      documentName: citation.knowledgeDocument?.originalName ?? "Supporting document",
      documentStatus: citation.knowledgeDocument?.status ?? null,
      documentVersionId: citation.knowledgeVersionId,
      revisionLabel: citation.knowledgeVersion?.revisionLabel ?? null,
      effectiveDate: citation.knowledgeVersion?.effectiveDate ?? null,
      chunkId: citation.knowledgeChunkId,
      page: citation.knowledgeChunk?.pageNumber ?? citation.pageNumber,
      section: citation.knowledgeChunk?.sectionTitle ?? citation.sectionTitle,
      excerpt: citation.knowledgeChunk?.excerpt ?? citation.excerpt,
    };
  }

  private notFound(): never {
    throw new ApiException(
      "CITATION_NOT_FOUND",
      "The citation was not found.",
      HttpStatus.NOT_FOUND,
    );
  }
}
