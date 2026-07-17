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
    this.logger.log(
      JSON.stringify({ event: "worker_started", workerId, concurrency: 1, leaseSeconds }),
    );

    while (this.running) {
      try {
        const recovery = await this.queue.recoverStale();
        const recovered = recovery[0];
        if (recovered && (recovered.requeued_count > 0 || recovered.failed_count > 0)) {
          this.logger.warn(
            JSON.stringify({
              event: "stale_jobs_recovered",
              workerId,
              requeuedCount: recovered.requeued_count,
              failedCount: recovered.failed_count,
            }),
          );
        }
        const claimed = await this.queue.claim(workerId, leaseSeconds);
        if (!claimed) {
          await wait(1000);
          continue;
        }
        this.logger.log(
          JSON.stringify({
            event: "analysis_claimed",
            workerId,
            analysisId: claimed.id,
            attemptCount: claimed.attemptCount,
          }),
        );
        try {
          await this.processor.process(claimed, workerId, leaseSeconds);
        } catch (error) {
          await this.queue.fail(claimed.id, workerId, error);
          this.logger.warn(
            JSON.stringify({
              event: "analysis_processing_failed",
              workerId,
              analysisId: claimed.id,
              errorName: error instanceof Error ? error.name : "UnknownError",
            }),
          );
        }
      } catch (error) {
        const errorName = error instanceof Error ? error.name : "UnknownError";
        this.logger.error(JSON.stringify({ event: "worker_loop_error", workerId, errorName }));
        await wait(2000);
      }
    }
  }
}
