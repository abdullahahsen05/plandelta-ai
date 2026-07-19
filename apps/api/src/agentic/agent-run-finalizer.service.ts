import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";
import type { AgentExecutionResponse } from "./agent-response.schema.js";

@Injectable()
export class AgentRunFinalizerService {
  constructor(private readonly database: DatabaseService) {}

  async complete(
    runId: string,
    workerId: string,
    execution: AgentExecutionResponse,
  ): Promise<void> {
    await this.database.inTransaction(async (transaction) => {
      const run = await transaction.agentRun.findFirst({
        where: { id: runId, leaseOwner: workerId, status: { in: ["RUNNING", "VERIFYING"] } },
        include: { conversation: { select: { ownerId: true } } },
      });
      if (!run) throw new Error("Agent run lease ownership was lost.");
      if (run.cancellationRequested) {
        await transaction.agentRun.update({
          where: { id: runId },
          data: {
            status: "CANCELLED",
            failureCode: "AGENT_CANCELLED",
            completedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
          },
        });
        return;
      }

      const { answer } = execution.result;
      const assistantMessageId = run.assistantMessageId ?? randomUUID();
      await transaction.message.upsert({
        where: { id: assistantMessageId },
        create: {
          id: assistantMessageId,
          conversationId: run.conversationId,
          role: "ASSISTANT",
          messageType: answer.rfiDraft ? "RFI_DRAFT" : "ANSWER",
          status: "COMPLETED",
          content: answer.answerMarkdown,
          answerStatus: answer.status,
          confidence: answer.confidence,
          rfiDraft: answer.rfiDraft
            ? (answer.rfiDraft as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          provider: answer.provider,
          modelId: answer.modelId,
          promptVersion: answer.promptVersion,
          inputTokens: execution.result.inputTokens,
          outputTokens: execution.result.outputTokens,
          estimatedCostUsd: execution.result.estimatedCostUsd,
          warnings: answer.warnings,
        },
        update: {
          status: "COMPLETED",
          content: answer.answerMarkdown,
          answerStatus: answer.status,
          confidence: answer.confidence,
          rfiDraft: answer.rfiDraft
            ? (answer.rfiDraft as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          provider: answer.provider,
          modelId: answer.modelId,
          promptVersion: answer.promptVersion,
          inputTokens: execution.result.inputTokens,
          outputTokens: execution.result.outputTokens,
          estimatedCostUsd: execution.result.estimatedCostUsd,
          warnings: answer.warnings,
        },
      });

      for (const citation of answer.citations) {
        if (!citation.verified || citation.projectId !== run.projectId) {
          throw new Error("The agent returned an unverified or cross-project citation.");
        }
        const target = citation.target;
        await transaction.citation.upsert({
          where: { id: citation.id },
          create: {
            id: citation.id,
            messageId: assistantMessageId,
            agentRunId: runId,
            projectId: run.projectId,
            displayOrder: citation.displayOrder,
            citationType:
              target.type === "visual_change" ? "VISUAL_CHANGE" : "DOCUMENT_CHUNK",
            label: citation.label,
            supportsClaimIds: citation.supportsClaimIds,
            detectedChangeId: target.type === "visual_change" ? target.changeId : null,
            artifactId: target.type === "visual_change" ? target.artifactId : null,
            analysisId: target.type === "visual_change" ? target.analysisId : null,
            normalizedRegion:
              target.type === "visual_change" && target.region
                ? (target.region as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            knowledgeDocumentId: target.type === "document_chunk" ? target.documentId : null,
            knowledgeVersionId:
              target.type === "document_chunk" ? target.documentVersionId : null,
            knowledgeChunkId: target.type === "document_chunk" ? target.chunkId : null,
            pageNumber: target.type === "document_chunk" ? target.page : null,
            sectionTitle: target.type === "document_chunk" ? target.section : null,
            excerpt: target.type === "document_chunk" ? target.excerpt : null,
            retrievalMetadata:
              target.type === "document_chunk"
                ? { isActive: target.isActive, isConflicting: target.isConflicting }
                : {},
            verifiedAt: new Date(),
          },
          update: {
            label: citation.label,
            supportsClaimIds: citation.supportsClaimIds,
            verifiedAt: new Date(),
          },
        });
      }

      await transaction.agentRun.update({
        where: { id: runId },
        data: {
          assistantMessageId,
          status: "COMPLETED",
          selectedSpecialists: execution.result.selectedSpecialists,
          modelTurnCount: execution.result.modelTurns,
          toolCallCount: execution.result.toolCalls,
          retrievedChunkCount: execution.result.retrievedChunks,
          repairCount: execution.result.repairPasses,
          inputTokens: execution.result.inputTokens,
          outputTokens: execution.result.outputTokens,
          estimatedCostUsd: execution.result.estimatedCostUsd,
          verifierOutcome: execution.result.verifier.approved ? "approved" : "safe_fallback",
          failureCode: execution.result.safeError?.code ?? null,
          completedAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: run.conversation.ownerId,
          projectId: run.projectId,
          analysisId: run.analysisId,
          eventType: "AGENT_RUN_COMPLETED",
          correlationId: run.correlationId,
          metadata: {
            runId,
            assistantMessageId,
            citationCount: answer.citations.length,
            verifierOutcome: execution.result.verifier.approved ? "approved" : "safe_fallback",
          },
        },
      });
    });
  }
}
