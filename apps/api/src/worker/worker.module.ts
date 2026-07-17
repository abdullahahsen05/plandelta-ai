import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { AnalysisProcessorService } from "./analysis-processor.service.js";
import { JobQueueService } from "./job-queue.service.js";
import { VisionClient } from "./vision-client.js";
import { WorkerRunnerService } from "./worker-runner.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [JobQueueService, VisionClient, AnalysisProcessorService, WorkerRunnerService],
})
export class WorkerModule {}
