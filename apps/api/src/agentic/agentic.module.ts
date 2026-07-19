import { Module } from "@nestjs/common";

import { AgentRunFinalizerService } from "./agent-run-finalizer.service.js";
import { AgentRunsController } from "./agent-runs.controller.js";
import { AgentServiceClient } from "./agent-service.client.js";
import { AgenticQueueService } from "./agentic-queue.service.js";
import { CitationsController } from "./citations.controller.js";
import { CitationsService } from "./citations.service.js";
import { ConversationsController } from "./conversations.controller.js";
import { ConversationsService } from "./conversations.service.js";

@Module({
  controllers: [ConversationsController, AgentRunsController, CitationsController],
  providers: [
    ConversationsService,
    CitationsService,
    AgentServiceClient,
    AgenticQueueService,
    AgentRunFinalizerService,
  ],
  exports: [AgentServiceClient, AgenticQueueService, AgentRunFinalizerService],
})
export class AgenticModule {}
