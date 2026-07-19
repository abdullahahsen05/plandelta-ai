import { setTimeout as wait } from "node:timers/promises";

import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";

import { AgentRunFinalizerService } from "./agent-run-finalizer.service.js";
import { AgentServiceClient } from "./agent-service.client.js";
import { AgenticQueueService } from "./agentic-queue.service.js";

@Injectable()
export class AgenticWorkerRunnerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AgenticWorkerRunnerService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly queue: AgenticQueueService,
    private readonly agent: AgentServiceClient,
    private readonly finalizer: AgentRunFinalizerService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.AGENT_ENABLED !== "true") return;
    this.running = true;
    this.loopPromise = this.runLoop();
  }

  async onApplicationShutdown() {
    this.running = false;
    await this.loopPromise;
  }

  private async runLoop() {
    const workerId = `${process.env.WORKER_ID ?? "local-worker-1"}-agentic`;
    const leaseSeconds = Number(process.env.AGENT_JOB_LEASE_SECONDS ?? 120);
    this.logger.log(JSON.stringify({ event: "agentic_worker_started", workerId, concurrency: 1 }));
    while (this.running) {
      try {
        await Promise.all([this.queue.recoverIngestion(), this.queue.recoverRuns()]);
        const ingestion = await this.queue.claimIngestion(workerId, leaseSeconds);
        if (ingestion) {
          await this.executeWithHeartbeat(
            ingestion.id,
            leaseSeconds,
            (signal) => this.agent.executeIngestion(ingestion.id, ingestion.id, signal),
            () => this.queue.heartbeatIngestion(ingestion.id, workerId, leaseSeconds),
            () => this.queue.failIngestion(ingestion.id, workerId),
          );
          continue;
        }
        const run = await this.queue.claimRun(workerId, leaseSeconds);
        if (run) {
          await this.executeWithHeartbeat(
            run.id,
            leaseSeconds,
            async (signal) => {
              const execution = await this.agent.executeRun(
                run.id,
                run.correlationId,
                signal,
              );
              await this.finalizer.complete(run.id, workerId, execution);
            },
            () => this.queue.heartbeatRun(run.id, workerId, leaseSeconds),
            () => this.queue.failRun(run.id, workerId, "AGENT_MODEL_UNAVAILABLE"),
          );
          continue;
        }
        await wait(750);
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            event: "agentic_worker_loop_error",
            errorName: error instanceof Error ? error.name : "UnknownError",
          }),
        );
        await wait(2_000);
      }
    }
  }

  private async executeWithHeartbeat(
    jobId: string,
    leaseSeconds: number,
    operation: (signal: AbortSignal) => Promise<void>,
    heartbeat: () => Promise<boolean>,
    fail: () => Promise<void>,
  ) {
    const controller = new AbortController();
    const timer = setInterval(
      () => {
        void heartbeat().then((retained) => {
          if (!retained) controller.abort();
        });
      },
      Math.max(10_000, Math.floor((leaseSeconds * 1000) / 3)),
    );
    timer.unref();
    try {
      await operation(controller.signal);
      this.logger.log(JSON.stringify({ event: "agentic_job_completed", jobId }));
    } catch (error) {
      await fail();
      this.logger.warn(
        JSON.stringify({
          event: "agentic_job_failed",
          jobId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    } finally {
      clearInterval(timer);
    }
  }
}
