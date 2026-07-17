import { Module } from "@nestjs/common";

import { RevisionsController } from "./revisions.controller.js";
import { RevisionsService } from "./revisions.service.js";

@Module({
  controllers: [RevisionsController],
  providers: [RevisionsService],
  exports: [RevisionsService],
})
export class RevisionsModule {}
