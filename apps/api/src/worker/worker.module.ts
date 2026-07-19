import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { AgenticModule } from "../agentic/agentic.module.js";
import { AgenticWorkerRunnerService } from "../agentic/agentic-worker-runner.service.js";
import { StorageModule } from "../storage/storage.module.js";
import { SummaryModule } from "../summary/summary.module.js";
import { AnalysisProcessorService } from "./analysis-processor.service.js";
import { JobQueueService } from "./job-queue.service.js";
import { VisionClient } from "./vision-client.js";
import { WorkerRunnerService } from "./worker-runner.service.js";

@Module({
  imports: [DatabaseModule, StorageModule, SummaryModule, AgenticModule],
  providers: [
    JobQueueService,
    VisionClient,
    AnalysisProcessorService,
    WorkerRunnerService,
    AgenticWorkerRunnerService,
  ],
})
export class WorkerModule {}
