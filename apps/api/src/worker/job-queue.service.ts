import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import type { Analysis, AnalysisStatus } from "../generated/prisma/client.js";
import { DatabaseService } from "../database/database.service.js";
import { VisionServiceError } from "./vision-client.js";

@Injectable()
export class JobQueueService {
  constructor(private readonly database: DatabaseService) {}

  async claim(workerId: string, leaseSeconds: number) {
    const rows = await this.database.$queryRaw<Analysis[]>(
      Prisma.sql`SELECT * FROM public.claim_analysis(${workerId}, ${leaseSeconds})`,
    );
    return rows[0] ?? null;
  }

  async heartbeat(analysisId: string, workerId: string, leaseSeconds: number) {
    const rows = await this.database.$queryRaw<Array<{ heartbeat_analysis: boolean }>>(
      Prisma.sql`SELECT public.heartbeat_analysis(${analysisId}::uuid, ${workerId}, ${leaseSeconds})`,
    );
    return rows[0]?.heartbeat_analysis ?? false;
  }

  recoverStale() {
    return this.database.$queryRaw<Array<{ requeued_count: number; failed_count: number }>>(
      Prisma.sql`SELECT * FROM public.recover_stale_analyses()`,
    );
  }

  async isCancellationRequested(analysisId: string, workerId: string) {
    const analysis = await this.database.analysis.findFirst({
      where: { id: analysisId, leaseOwner: workerId },
      select: { cancellationRequested: true },
    });
    return analysis?.cancellationRequested ?? true;
  }

  async advance(
    analysisId: string,
    workerId: string,
    status: AnalysisStatus,
    currentStage: string,
    progress: number,
  ) {
    const updated = await this.database.analysis.updateMany({
      where: { id: analysisId, leaseOwner: workerId, cancellationRequested: false },
      data: { status, currentStage, progress },
    });
    if (updated.count !== 1) throw new Error("Analysis lease ownership was lost.");
  }

  async fail(analysisId: string, workerId: string, error: unknown) {
    const analysis = await this.database.analysis.findUnique({
      where: { id: analysisId },
      select: { attemptCount: true, maxAttempts: true, cancellationRequested: true },
    });
    if (!analysis) return;
    if (analysis.cancellationRequested) {
      await this.database.analysis.updateMany({
        where: { id: analysisId, leaseOwner: workerId },
        data: {
          status: "CANCELLED",
          currentStage: "cancelled",
          nextAttemptAt: null,
          completedAt: new Date(),
          errorCode: "ANALYSIS_CANCELLED",
          errorMessage: "The analysis was cancelled.",
          leaseOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
        },
      });
      return;
    }
    const retryable = !(error instanceof VisionServiceError) || error.retryable;
    const retry = retryable && analysis.attemptCount < analysis.maxAttempts;
    const retryDelaySeconds = Math.min(300, 2 ** Math.max(analysis.attemptCount, 1) * 5);
    await this.database.analysis.updateMany({
      where: { id: analysisId, leaseOwner: workerId },
      data: {
        status: retry ? "RETRYING" : "FAILED",
        currentStage: retry ? "retry_scheduled" : "failed",
        nextAttemptAt: retry ? new Date(Date.now() + retryDelaySeconds * 1000) : null,
        completedAt: retry ? null : new Date(),
        errorCode: retry
          ? "TEMPORARY_PROCESSING_FAILURE"
          : error instanceof VisionServiceError
            ? error.code
            : "PROCESSING_FAILED",
        errorMessage:
          error instanceof VisionServiceError
            ? error.safeMessage
            : error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)
            ? "The vision service timed out."
            : "The analysis could not be completed.",
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
      },
    });
  }
}
