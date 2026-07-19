import { Module } from "@nestjs/common";

import { KnowledgeDocumentsController } from "./knowledge-documents.controller.js";
import { KnowledgeDocumentsService } from "./knowledge-documents.service.js";

@Module({
  controllers: [KnowledgeDocumentsController],
  providers: [KnowledgeDocumentsService],
  exports: [KnowledgeDocumentsService],
})
export class KnowledgeModule {}
