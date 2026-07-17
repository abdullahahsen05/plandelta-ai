import { setTimeout as wait } from "node:timers/promises";

import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";

import { AnalysisProcessorService } from "./analysis-processor.service.js";
import { JobQueueService } from "./job-queue.service.js";

@Injectable()
export class WorkerRunnerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerRunnerService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly queue: JobQueueService,
    private readonly processor: AnalysisProcessorService,
  ) {}

  onApplicationBootstrap() {
    this.running = true;
    this.loopPromise = this.runLoop();
  }

  async onApplicationShutdown() {
    this.running = false;
    await this.loopPromise;
  }

  private async runLoop() {
    const workerId = process.env.WORKER_ID ?? "local-worker-1";
    const leaseSeconds = Number(process.env.JOB_LEASE_SECONDS ?? 300);
    this.logger.log(`Worker started; workerId=${workerId}; concurrency=1`);

    while (this.running) {
      try {
        await this.queue.recoverStale();
        const claimed = await this.queue.claim(workerId, leaseSeconds);
        if (!claimed) {
          await wait(1000);
          continue;
        }
        try {
          await this.processor.process(claimed, workerId, leaseSeconds);
        } catch (error) {
          await this.queue.fail(claimed.id, workerId, error);
          this.logger.warn(`Analysis failed safely; analysisId=${claimed.id}`);
        }
      } catch (error) {
        const errorName = error instanceof Error ? error.name : "UnknownError";
        this.logger.error(`Worker loop error: ${errorName}`);
        await wait(2000);
      }
    }
  }
}
