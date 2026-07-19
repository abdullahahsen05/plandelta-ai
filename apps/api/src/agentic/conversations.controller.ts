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
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { CreateAgentMessageDto, CreateConversationDto } from "./agentic.dto.js";
import { ConversationsService } from "./conversations.service.js";

@ApiTags("evidence copilot")
@ApiBearerAuth()
@Controller()
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post("projects/:projectId/conversations")
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateConversationDto,
  ) {
    return this.conversations.create(auth.userId, projectId, input);
  }

  @Get("projects/:projectId/conversations")
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ) {
    return this.conversations.list(auth.userId, projectId);
  }

  @Get("conversations/:conversationId")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ) {
    return this.conversations.get(auth.userId, conversationId);
  }

  @Delete("conversations/:conversationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @CurrentAuth() auth: AuthContext,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ) {
    return this.conversations.archive(auth.userId, conversationId);
  }

  @Post("conversations/:conversationId/messages")
  createMessage(
    @CurrentAuth() auth: AuthContext,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() input: CreateAgentMessageDto,
    @Req() request: Request,
  ) {
    return this.conversations.createMessage(
      auth.userId,
      conversationId,
      input,
      request.correlationId ?? "missing",
    );
  }

  @Get("conversations/:conversationId/messages")
  messages(
    @CurrentAuth() auth: AuthContext,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ) {
    return this.conversations.messages(auth.userId, conversationId);
  }
}
