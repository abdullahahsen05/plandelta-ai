import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { Prisma, type Analysis } from "../generated/prisma/client.js";
import { LocalStorageProvider } from "../storage/local-storage.provider.js";
import { OBJECT_STORAGE, type ObjectStorage } from "../storage/storage.types.js";
import { SUMMARY_PROVIDER, type SummaryProvider } from "../summary/summary.types.js";
import { persistVisionArtifacts } from "./artifact-persistence.js";
import { JobQueueService } from "./job-queue.service.js";
import { VisionClient } from "./vision-client.js";

@Injectable()
export class AnalysisProcessorService {
  private readonly logger = new Logger(AnalysisProcessorService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly queue: JobQueueService,
    private readonly vision: VisionClient,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly localStorage: LocalStorageProvider,
    @Inject(SUMMARY_PROVIDER) private readonly summary: SummaryProvider,
  ) {}

  private async throwIfCancelled(
    analysisId: string,
    workerId: string,
    controller: AbortController,
  ) {
    if (!(await this.queue.isCancellationRequested(analysisId, workerId))) return;
    controller.abort();
    const error = new Error("Analysis cancellation requested.");
    error.name = "AbortError";
    throw error;
  }

  async process(claimed: Analysis, workerId: string, leaseSeconds: number) {
    const startedAt = Date.now();
    const correlationId = randomUUID();
    this.logger.log(
      JSON.stringify({
        event: "analysis_processing_started",
        analysisId: claimed.id,
        workerId,
        correlationId,
      }),
    );
    const heartbeat = setInterval(
      () => {
        void this.queue.heartbeat(claimed.id, workerId, leaseSeconds);
      },
      Math.max(10_000, Math.floor((leaseSeconds * 1000) / 3)),
    );
    heartbeat.unref();
    const cancellationController = new AbortController();
    const cancellationPoll = setInterval(() => {
      void this.queue
        .isCancellationRequested(claimed.id, workerId)
        .then((requested) => {
          if (requested) cancellationController.abort();
        })
        .catch(() => undefined);
    }, 1000);
    cancellationPoll.unref();

    try {
      const analysis = await this.database.analysis.findUnique({
        where: { id: claimed.id },
        include: { baselineRevision: true, candidateRevision: true },
      });
      if (!analysis) throw new Error("Claimed analysis no longer exists.");
      await this.throwIfCancelled(analysis.id, workerId, cancellationController);
      await this.queue.advance(analysis.id, workerId, "PREPROCESSING", "vision_request", 5);

      const referenceLifetime = Math.min(
        900,
        Math.max(30, Number(process.env.VISION_TIMEOUT_SECONDS ?? 240) + 60),
      );
      const [baseline, candidate] = await Promise.all([
        this.storage.createReadReference(analysis.baselineRevision.storageKey, referenceLifetime),
        this.storage.createReadReference(analysis.candidateRevision.storageKey, referenceLifetime),
      ]);
      const scratchPrefix =
        this.storage.provider === "LOCAL"
          ? `analyses/${analysis.id}`
          : `scratch/${analysis.id}/${correlationId}`;
      const visionResult = await this.vision.analyze({
        analysisId: analysis.id,
        correlationId,
        baseline,
        candidate,
        selectedPage: Number(
          (analysis.configuration as { page?: unknown } | null)?.page ??
            analysis.candidateRevision.selectedPage ??
            1,
        ),
        analysisProfile:
          analysis.analysisProfile === "ENGINEERING_SCHEMATIC"
            ? "engineering_schematic"
            : "construction_drawing",
        configuration: analysis.configuration,
        artifactOutput: { kind: "local", prefix: scratchPrefix },
        signal: cancellationController.signal,
      });
      await this.throwIfCancelled(analysis.id, workerId, cancellationController);
      if (visionResult.analysisId !== analysis.id) {
        await this.localStorage.deletePrefix(scratchPrefix).catch(() => undefined);
        throw new Error("Vision result analysis id mismatch.");
      }
      const result = await persistVisionArtifacts(
        visionResult,
        analysis.id,
        scratchPrefix,
        this.storage,
        this.localStorage,
      );

      await this.database.inTransaction(async (transaction) => {
        const stillActive = await transaction.analysis.updateMany({
          where: {
            id: analysis.id,
            leaseOwner: workerId,
            cancellationRequested: false,
          },
          data: { updatedAt: new Date() },
        });
        if (stillActive.count !== 1) throw new Error("Analysis cancellation requested.");
        await transaction.detectedChange.deleteMany({ where: { analysisId: analysis.id } });
        await transaction.analysisArtifact.deleteMany({ where: { analysisId: analysis.id } });
        if (result.changes.length > 0) {
          await transaction.detectedChange.createMany({
            data: result.changes.map((change) => ({
              analysisId: analysis.id,
              sequence: change.sequence,
              changeType: change.changeType,
              category: change.category,
              source: change.source,
              x: change.box.x,
              y: change.box.y,
              width: change.box.width,
              height: change.box.height,
              polygon: change.polygon ?? Prisma.DbNull,
              confidence: change.confidence,
              oldText: change.oldText,
              newText: change.newText,
              textConfidence: change.textConfidence,
              affectedTrades: change.affectedTrades,
              quantityDelta: change.quantityDelta,
              unit: change.unit,
              impact: change.impact,
              evidence: change.evidence,
            })),
          });
        }
        if (result.artifacts.length > 0) {
          await transaction.analysisArtifact.createMany({
            data: result.artifacts.map((artifact) => ({
              analysisId: analysis.id,
              kind: artifact.kind,
              storageProvider: this.storage.provider,
              storageKey: artifact.storageKey,
              mimeType: artifact.mimeType,
              widthPx: artifact.widthPx,
              heightPx: artifact.heightPx,
              byteSize: artifact.byteSize,
              checksumSha256: artifact.checksumSha256,
              metadata: artifact.metadata,
            })),
          });
        }
      });
      await this.queue.advance(analysis.id, workerId, "SUMMARIZING", "summary", 90);
      const persistedChanges = await this.database.detectedChange.findMany({
        where: { analysisId: analysis.id },
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          changeType: true,
          category: true,
          confidence: true,
          oldText: true,
          newText: true,
          affectedTrades: true,
          impact: true,
        },
      });
      const summary = await this.summary.summarizeAnalysis(persistedChanges, {
        analysisProfile: analysis.analysisProfile,
      });
      await this.throwIfCancelled(analysis.id, workerId, cancellationController);

      await this.database.inTransaction(async (transaction) => {
        await transaction.analysisReport.upsert({
          where: { analysisId: analysis.id },
          create: {
            analysisId: analysis.id,
            executiveSummary: summary.executiveSummary,
            structuredSummary: summary.structuredSummary as Prisma.InputJsonValue,
            provider: summary.provider,
            modelId: summary.modelId,
            promptVersion: summary.promptVersion,
          },
          update: {
            executiveSummary: summary.executiveSummary,
            structuredSummary: summary.structuredSummary as Prisma.InputJsonValue,
            provider: summary.provider,
            modelId: summary.modelId,
            promptVersion: summary.promptVersion,
          },
        });
        const completion = await transaction.analysis.updateMany({
          where: {
            id: analysis.id,
            leaseOwner: workerId,
            cancellationRequested: false,
          },
          data: {
            status: "COMPLETED",
            progress: 100,
            currentStage: "completed",
            schemaVersion: result.schemaVersion,
            engineVersion: result.engineVersion,
            metrics: { ...result.metrics, alignment: result.alignment },
            warnings: summary.warning ? [...result.warnings, summary.warning] : result.warnings,
            summaryProvider: summary.provider,
            completedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
            errorCode: null,
            errorMessage: null,
          },
        });
        if (completion.count !== 1) throw new Error("Analysis lease ownership was lost.");
      });
      this.logger.log(
        JSON.stringify({
          event: "analysis_processing_completed",
          analysisId: analysis.id,
          workerId,
          correlationId,
          durationMs: Date.now() - startedAt,
          regionCount: result.changes.length,
          engineVersion: result.engineVersion,
        }),
      );
    } finally {
      clearInterval(heartbeat);
      clearInterval(cancellationPoll);
    }
  }
}
