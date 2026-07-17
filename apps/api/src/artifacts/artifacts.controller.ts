import { Controller, Get, Param, ParseUUIDPipe, Res, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { ArtifactsService } from "./artifacts.service.js";

@ApiTags("artifacts")
@ApiBearerAuth()
@Controller()
export class ArtifactsController {
  constructor(private readonly artifacts: ArtifactsService) {}

  @Get("analyses/:analysisId/artifacts")
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
  ) {
    return this.artifacts.list(auth.userId, analysisId);
  }

  @Get("artifacts/:artifactId/download")
  async download(
    @CurrentAuth() auth: AuthContext,
    @Param("artifactId", new ParseUUIDPipe()) artifactId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { artifact, bytes } = await this.artifacts.download(auth.userId, artifactId);
    response.setHeader("content-type", artifact.mimeType);
    response.setHeader(
      "content-disposition",
      `attachment; filename="${artifact.kind.toLowerCase()}"`,
    );
    response.setHeader("cache-control", "private, no-store");
    return new StreamableFile(bytes);
  }
}
