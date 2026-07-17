import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import type { Response } from "express";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { UpdateRevisionDto, UploadRevisionDto } from "./revision.dto.js";
import { RevisionsService } from "./revisions.service.js";

@ApiTags("revisions")
@ApiBearerAuth()
@Controller()
export class RevisionsController {
  constructor(private readonly revisions: RevisionsService) {}

  @Post("projects/:projectId/revisions")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "label", "role"],
      properties: {
        file: { type: "string", format: "binary" },
        label: { type: "string", maxLength: 120 },
        role: { type: "string", enum: ["BASELINE", "CANDIDATE"] },
        revisionCode: { type: "string", maxLength: 32 },
        selectedPage: { type: "integer", minimum: 1, default: 1 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024), files: 1 },
    }),
  )
  upload(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body() input: UploadRevisionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.revisions.upload(auth.userId, projectId, input, file);
  }

  @Get("projects/:projectId/revisions")
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ) {
    return this.revisions.list(auth.userId, projectId);
  }

  @Get("revisions/:revisionId")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("revisionId", new ParseUUIDPipe()) revisionId: string,
  ) {
    return this.revisions.getOwned(auth.userId, revisionId);
  }

  @Patch("revisions/:revisionId")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("revisionId", new ParseUUIDPipe()) revisionId: string,
    @Body() input: UpdateRevisionDto,
  ) {
    return this.revisions.update(auth.userId, revisionId, input);
  }

  @Delete("revisions/:revisionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentAuth() auth: AuthContext,
    @Param("revisionId", new ParseUUIDPipe()) revisionId: string,
  ) {
    return this.revisions.delete(auth.userId, revisionId);
  }

  @Get("revisions/:revisionId/preview")
  async preview(
    @CurrentAuth() auth: AuthContext,
    @Param("revisionId", new ParseUUIDPipe()) revisionId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { revision, bytes } = await this.revisions.preview(auth.userId, revisionId);
    response.setHeader("content-type", revision.mimeType);
    response.setHeader("content-disposition", "inline");
    response.setHeader("cache-control", "private, no-store");
    return new StreamableFile(bytes);
  }
}
