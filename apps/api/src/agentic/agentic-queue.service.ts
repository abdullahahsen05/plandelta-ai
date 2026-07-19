import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { DatabaseService } from "../database/database.service.js";

type IngestionJobClaim = {
  id: string;
};

type AgentRunClaim = {
  id: string;
  correlationId: string;
};

@Injectable()
export class AgenticQueueService {
  constructor(private readonly database: DatabaseService) {}

  async claimIngestion(workerId: string, leaseSeconds: number) {
    const rows = await this.database.$queryRaw<IngestionJobClaim[]>(
      Prisma.sql`SELECT * FROM public.claim_ingestion_job(${workerId}, ${leaseSeconds})`,
    );
    return rows[0] ?? null;
  }

  async heartbeatIngestion(jobId: string, workerId: string, leaseSeconds: number) {
    const rows = await this.database.$queryRaw<Array<{ heartbeat_ingestion_job: boolean }>>(
      Prisma.sql`SELECT public.heartbeat_ingestion_job(${jobId}::uuid, ${workerId}, ${leaseSeconds})`,
    );
    return rows[0]?.heartbeat_ingestion_job ?? false;
  }

  recoverIngestion() {
    return this.database.$queryRaw<Array<{ requeued_count: number; failed_count: number }>>(
      Prisma.sql`SELECT * FROM public.recover_stale_ingestion_jobs()`,
    );
  }

  async claimRun(workerId: string, leaseSeconds: number) {
    const rows = await this.database.$queryRaw<AgentRunClaim[]>(
      Prisma.sql`
        SELECT id, correlation_id AS "correlationId"
        FROM public.claim_agent_run(${workerId}, ${leaseSeconds})
      `,
    );
    return rows[0] ?? null;
  }

  async heartbeatRun(runId: string, workerId: string, leaseSeconds: number) {
    const rows = await this.database.$queryRaw<Array<{ heartbeat_agent_run: boolean }>>(
      Prisma.sql`SELECT public.heartbeat_agent_run(${runId}::uuid, ${workerId}, ${leaseSeconds})`,
    );
    return rows[0]?.heartbeat_agent_run ?? false;
  }

  recoverRuns() {
    return this.database.$queryRaw<
      Array<{ requeued_count: number; failed_count: number; cancelled_count: number }>
    >(Prisma.sql`SELECT * FROM public.recover_stale_agent_runs()`);
  }

  async depths() {
    const [agentRuns, ingestionJobs] = await Promise.all([
      this.database.agentRun.count({ where: { status: "QUEUED" } }),
      this.database.ingestionJob.count({ where: { status: "QUEUED" } }),
    ]);
    return { agentRuns, ingestionJobs };
  }

  async failIngestion(jobId: string, workerId: string) {
    const job = await this.database.ingestionJob.findUnique({
      where: { id: jobId },
      select: { attemptCount: true, maxAttempts: true },
    });
    if (!job) return;
    const retry = job.attemptCount < job.maxAttempts;
    await this.database.ingestionJob.updateMany({
      where: { id: jobId, leaseOwner: workerId },
      data: {
        status: retry ? "RETRYING" : "FAILED",
        currentStage: retry ? "retry_scheduled" : "failed",
        nextAttemptAt: retry ? new Date(Date.now() + 5_000) : null,
        failureCode: retry ? null : "KNOWLEDGE_INGESTION_FAILED",
        completedAt: retry ? null : new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
      },
    });
  }

  async failRun(runId: string, workerId: string, code: string) {
    const run = await this.database.agentRun.findUnique({
      where: { id: runId },
      select: {
        attemptCount: true,
        maxAttempts: true,
        cancellationRequested: true,
        deadlineAt: true,
      },
    });
    if (!run) return;
    const cancelled = run.cancellationRequested;
    const expired = run.deadlineAt <= new Date();
    const retry = !cancelled && !expired && run.attemptCount < run.maxAttempts;
    await this.database.agentRun.updateMany({
      where: { id: runId, leaseOwner: workerId },
      data: {
        status: cancelled ? "CANCELLED" : expired ? "EXPIRED" : retry ? "QUEUED" : "FAILED",
        nextAttemptAt: retry ? new Date(Date.now() + 5_000) : null,
        failureCode: cancelled ? "AGENT_CANCELLED" : expired ? "AGENT_TIMEOUT" : code,
        completedAt: retry ? null : new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
      },
    });
  }
}
