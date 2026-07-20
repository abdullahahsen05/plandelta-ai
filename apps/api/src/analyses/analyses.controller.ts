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
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { AnalysisListQueryDto, CreateAnalysisDto } from "./analysis.dto.js";
import { AnalysesService } from "./analyses.service.js";

@ApiTags("analyses")
@ApiBearerAuth()
@Controller()
export class AnalysesController {
  constructor(private readonly analyses: AnalysesService) {}

  @Post("projects/:projectId/analyses")
  @HttpCode(HttpStatus.ACCEPTED)
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateAnalysisDto,
  ) {
    return this.analyses.create(auth.userId, projectId, input);
  }

  @Get("projects/:projectId/analyses")
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query() query: AnalysisListQueryDto,
  ) {
    return this.analyses.list(auth.userId, projectId, query);
  }

  @Get("analyses/:analysisId")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
  ) {
    return this.analyses.getOwned(auth.userId, analysisId);
  }

  @Post("analyses/:analysisId/retry")
  retry(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
  ) {
    return this.analyses.retry(auth.userId, analysisId);
  }

  @Post("analyses/:analysisId/cancel")
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
  ) {
    return this.analyses.cancel(auth.userId, analysisId);
  }

  @Delete("analyses/:analysisId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
  ) {
    return this.analyses.delete(auth.userId, analysisId);
  }
}
