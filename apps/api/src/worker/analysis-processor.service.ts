import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { Prisma, type Analysis } from "../generated/prisma/client.js";
import { JobQueueService } from "./job-queue.service.js";
import { VisionClient } from "./vision-client.js";

@Injectable()
export class AnalysisProcessorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly queue: JobQueueService,
    private readonly vision: VisionClient,
  ) {}

  async process(claimed: Analysis, workerId: string, leaseSeconds: number) {
    const heartbeat = setInterval(
      () => {
        void this.queue.heartbeat(claimed.id, workerId, leaseSeconds);
      },
      Math.max(10_000, Math.floor((leaseSeconds * 1000) / 3)),
    );
    heartbeat.unref();

    try {
      const analysis = await this.database.analysis.findUnique({
        where: { id: claimed.id },
        include: { baselineRevision: true, candidateRevision: true },
      });
      if (!analysis) throw new Error("Claimed analysis no longer exists.");
      await this.queue.advance(analysis.id, workerId, "PREPROCESSING", "vision_request", 5);

      const result = await this.vision.analyze({
        analysisId: analysis.id,
        correlationId: randomUUID(),
        baseline: { kind: "local", path: analysis.baselineRevision.storageKey },
        candidate: { kind: "local", path: analysis.candidateRevision.storageKey },
        selectedPage: Number(
          (analysis.configuration as { page?: unknown } | null)?.page ??
            analysis.candidateRevision.selectedPage ??
            1,
        ),
        configuration: analysis.configuration,
        artifactOutput: { kind: "local", prefix: `analyses/${analysis.id}` },
      });
      if (result.analysisId !== analysis.id) throw new Error("Vision result analysis id mismatch.");

      await this.database.inTransaction(async (transaction) => {
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
              storageProvider: "LOCAL",
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
        const completion = await transaction.analysis.updateMany({
          where: { id: analysis.id, leaseOwner: workerId },
          data: {
            status: "COMPLETED",
            progress: 100,
            currentStage: "completed",
            schemaVersion: result.schemaVersion,
            engineVersion: result.engineVersion,
            metrics: { ...result.metrics, alignment: result.alignment },
            warnings: result.warnings,
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
    } finally {
      clearInterval(heartbeat);
    }
  }
}
