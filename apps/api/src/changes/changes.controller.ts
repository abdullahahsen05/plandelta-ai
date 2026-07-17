import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { ChangeListQueryDto } from "./change-query.dto.js";
import { ChangesService } from "./changes.service.js";

@ApiTags("changes")
@ApiBearerAuth()
@Controller("analyses/:analysisId/changes")
export class ChangesController {
  constructor(private readonly changes: ChangesService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("analysisId", new ParseUUIDPipe()) analysisId: string,
    @Query() query: ChangeListQueryDto,
  ) {
    return this.changes.list(auth.userId, analysisId, query);
  }
}
