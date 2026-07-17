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
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { CreateProjectDto, ProjectListQueryDto, UpdateProjectDto } from "./project.dto.js";
import { ProjectsService } from "./projects.service.js";

@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateProjectDto) {
    return this.projects.create(auth.userId, input);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() query: ProjectListQueryDto) {
    return this.projects.list(auth.userId, query);
  }

  @Get(":projectId")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ) {
    return this.projects.getOwned(auth.userId, projectId);
  }

  @Patch(":projectId")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body() input: UpdateProjectDto,
  ) {
    return this.projects.update(auth.userId, projectId, input);
  }

  @Delete(":projectId")
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ) {
    return this.projects.archive(auth.userId, projectId);
  }
}
