import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { UploadKnowledgeDocumentDto } from "./knowledge-document.dto.js";
import { KnowledgeDocumentsService } from "./knowledge-documents.service.js";

@ApiTags("knowledge documents")
@ApiBearerAuth()
@Controller("projects/:projectId/knowledge-documents")
export class KnowledgeDocumentsController {
  constructor(private readonly documents: KnowledgeDocumentsService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "documentType"],
      properties: {
        file: { type: "string", format: "binary" },
        documentType: {
          type: "string",
          enum: [
            "SPECIFICATION",
            "DRAWING_NOTES",
            "REVISION_NARRATIVE",
            "ADDENDUM",
            "BOQ_SCHEDULE",
            "RFI",
            "PRIOR_REPORT",
            "TECHNICAL_NOTE",
          ],
        },
        revisionLabel: { type: "string", maxLength: 120 },
        effectiveDate: { type: "string", format: "date" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: Number(process.env.KNOWLEDGE_MAX_FILE_BYTES ?? 20 * 1024 * 1024),
        files: 1,
      },
    }),
  )
  upload(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body() input: UploadKnowledgeDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(auth.userId, projectId, input, file);
  }

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ) {
    return this.documents.list(auth.userId, projectId);
  }

  @Get(":documentId")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.getOwned(auth.userId, projectId, documentId);
  }

  @Post(":documentId/retry")
  retry(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.retry(auth.userId, projectId, documentId);
  }

  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.delete(auth.userId, projectId, documentId);
  }

  @Get(":documentId/source")
  async source(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { document, bytes } = await this.documents.source(auth.userId, projectId, documentId);
    response.setHeader("content-type", document.detectedMimeType);
    response.setHeader(
      "content-disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
    );
    response.setHeader("cache-control", "private, no-store");
    return new StreamableFile(bytes);
  }
}
