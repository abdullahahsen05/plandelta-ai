import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { SummaryModule } from "../summary/summary.module.js";
import { AnalysisProcessorService } from "./analysis-processor.service.js";
import { JobQueueService } from "./job-queue.service.js";
import { VisionClient } from "./vision-client.js";
import { WorkerRunnerService } from "./worker-runner.service.js";

@Module({
  imports: [DatabaseModule, StorageModule, SummaryModule],
  providers: [JobQueueService, VisionClient, AnalysisProcessorService, WorkerRunnerService],
})
export class WorkerModule {}
