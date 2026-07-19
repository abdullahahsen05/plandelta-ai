import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { CitationsService } from "./citations.service.js";

@ApiTags("evidence citations")
@ApiBearerAuth()
@Controller()
export class CitationsController {
  constructor(private readonly citations: CitationsService) {}

  @Get("messages/:messageId/citations")
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
  ) {
    return this.citations.listForMessage(auth.userId, messageId);
  }

  @Get("citations/:citationId/source")
  source(
    @CurrentAuth() auth: AuthContext,
    @Param("citationId", new ParseUUIDPipe()) citationId: string,
  ) {
    return this.citations.source(auth.userId, citationId);
  }
}
