import { HttpStatus, Inject, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";
import { OBJECT_STORAGE, type ObjectStorage } from "../storage/storage.types.js";

const artifactSelect = {
  id: true,
  analysisId: true,
  kind: true,
  mimeType: true,
  widthPx: true,
  heightPx: true,
  byteSize: true,
  checksumSha256: true,
  metadata: true,
  createdAt: true,
} as const;

@Injectable()
export class ArtifactsService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async list(ownerId: string, analysisId: string) {
    const owned = await this.database.analysis.count({ where: { id: analysisId, project: { ownerId } } });
    if (!owned) throw new ApiException("ANALYSIS_NOT_FOUND", "The analysis was not found.", HttpStatus.NOT_FOUND);
    return this.database.analysisArtifact.findMany({
      where: { analysisId },
      select: artifactSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async download(ownerId: string, artifactId: string) {
    const artifact = await this.database.analysisArtifact.findFirst({
      where: { id: artifactId, analysis: { project: { ownerId } } },
    });
    if (!artifact) throw new ApiException("ARTIFACT_NOT_FOUND", "The artifact was not found.", HttpStatus.NOT_FOUND);
    return { artifact, bytes: await this.storage.read(artifact.storageKey) };
  }
}
