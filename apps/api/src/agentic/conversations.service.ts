import { randomUUID } from "node:crypto";

import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api.exception.js";
import { DatabaseService } from "../database/database.service.js";
import type { Prisma } from "../generated/prisma/client.js";
import type {
  CreateAgentMessageDto,
  CreateConversationDto,
} from "./agentic.dto.js";

const conversationSelect = {
  id: true,
  projectId: true,
  analysisId: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { messages: true, runs: true } },
} as const;

const messageSelect = {
  id: true,
  conversationId: true,
  role: true,
  messageType: true,
  status: true,
  content: true,
  answerStatus: true,
  confidence: true,
  rfiDraft: true,
  provider: true,
  modelId: true,
  promptVersion: true,
  warnings: true,
  createdAt: true,
  updatedAt: true,
  citations: {
    select: {
      id: true,
      displayOrder: true,
      citationType: true,
      label: true,
      supportsClaimIds: true,
      analysisId: true,
      detectedChangeId: true,
      artifactId: true,
      normalizedRegion: true,
      knowledgeDocumentId: true,
      knowledgeVersionId: true,
      knowledgeChunkId: true,
      pageNumber: true,
      sectionTitle: true,
      excerpt: true,
      verifiedAt: true,
    },
    orderBy: { displayOrder: "asc" as const },
  },
  requestedRuns: {
    select: {
      id: true,
      status: true,
      failureCode: true,
      cancellationRequested: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

const runSelect = {
  id: true,
  conversationId: true,
  userMessageId: true,
  assistantMessageId: true,
  projectId: true,
  analysisId: true,
  status: true,
  attemptCount: true,
  maxAttempts: true,
  cancellationRequested: true,
  selectedSpecialists: true,
  modelTurnCount: true,
  toolCallCount: true,
  retrievedChunkCount: true,
  repairCount: true,
  verifierOutcome: true,
  failureCode: true,
  correlationId: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ConversationsService {
  constructor(private readonly database: DatabaseService) {}

  async create(ownerId: string, projectId: string, input: CreateConversationDto) {
    const project = await this.database.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true, status: true },
    });
    if (!project) this.notFound();
    if (project.status === "ARCHIVED") {
      throw new ApiException(
        "PROJECT_ARCHIVED",
        "Archived projects cannot start conversations.",
        HttpStatus.CONFLICT,
      );
    }
    if (input.analysisId) {
      const analysis = await this.database.analysis.findFirst({
        where: { id: input.analysisId, projectId, status: "COMPLETED" },
        select: { id: true },
      });
      if (!analysis) {
        throw new ApiException(
          "AGENT_CONTEXT_NOT_READY",
          "Choose a completed analysis from this project.",
          HttpStatus.CONFLICT,
        );
      }
    }
    const conversation = await this.database.conversation.create({
      data: {
        ownerId,
        projectId,
        analysisId: input.analysisId ?? null,
        title: input.title?.trim() || "Evidence review",
      },
      select: conversationSelect,
    });
    await this.audit(ownerId, projectId, "AGENT_CONVERSATION_CREATED", {
      conversationId: conversation.id,
      hasAnalysis: Boolean(input.analysisId),
    });
    return conversation;
  }

  async list(ownerId: string, projectId: string) {
    await this.requireProject(ownerId, projectId);
    return this.database.conversation.findMany({
      where: { ownerId, projectId },
      select: conversationSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async get(ownerId: string, conversationId: string) {
    const conversation = await this.database.conversation.findFirst({
      where: { id: conversationId, ownerId },
      select: conversationSelect,
    });
    if (!conversation) this.notFound();
    return conversation;
  }

  async archive(ownerId: string, conversationId: string) {
    await this.get(ownerId, conversationId);
    await this.database.conversation.update({
      where: { id: conversationId },
      data: { status: "ARCHIVED" },
    });
  }

  async messages(ownerId: string, conversationId: string) {
    await this.get(ownerId, conversationId);
    return this.database.message.findMany({
      where: { conversationId },
      select: messageSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 500,
    });
  }

  async createMessage(
    ownerId: string,
    conversationId: string,
    input: CreateAgentMessageDto,
    correlationId: string,
  ) {
    const conversation = await this.database.conversation.findFirst({
      where: { id: conversationId, ownerId, status: "ACTIVE" },
      include: { project: { select: { analysisProfile: true, profileVersion: true } } },
    });
    if (!conversation) this.notFound();

    const existing = await this.database.message.findFirst({
      where: { conversationId, idempotencyKey: input.idempotencyKey },
      select: { id: true, requestedRuns: { select: runSelect, take: 1 } },
    });
    if (existing) {
      return { messageId: existing.id, runId: existing.requestedRuns[0]?.id ?? null };
    }
    await this.enforceQuota(ownerId, conversation.projectId);

    const messageId = randomUUID();
    const runId = randomUUID();
    const deadlineSeconds = Number(process.env.AGENT_QUEUE_DEADLINE_SECONDS ?? 600);
    try {
      await this.database.inTransaction(async (transaction) => {
        await transaction.message.create({
          data: {
            id: messageId,
            conversationId,
            authorId: ownerId,
            role: "USER",
            messageType: "QUESTION",
            status: "COMPLETED",
            content: input.content.trim(),
            idempotencyKey: input.idempotencyKey,
          },
        });
        await transaction.agentRun.create({
          data: {
            id: runId,
            conversationId,
            userMessageId: messageId,
            projectId: conversation.projectId,
            analysisId: conversation.analysisId,
            analysisProfile: conversation.project.analysisProfile,
            profileVersion: conversation.project.profileVersion,
            maxAttempts: Number(process.env.AGENT_MAX_ATTEMPTS ?? 3),
            deadlineAt: new Date(Date.now() + deadlineSeconds * 1000),
            correlationId,
          },
        });
        await transaction.agentStep.create({
          data: {
            agentRunId: runId,
            sequence: 1,
            nodeName: "queue",
            nodeVersion: "1",
            eventType: "run.queued",
            status: "COMPLETED",
            safeSummary: "Evidence run queued.",
            metadata: {},
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorId: ownerId,
            projectId: conversation.projectId,
            analysisId: conversation.analysisId,
            eventType: "AGENT_RUN_QUEUED",
            correlationId,
            metadata: { conversationId, messageId, runId },
          },
        });
        await transaction.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      });
    } catch (error) {
      const duplicate = await this.database.message.findFirst({
        where: { conversationId, idempotencyKey: input.idempotencyKey },
        select: { id: true, requestedRuns: { select: { id: true }, take: 1 } },
      });
      if (duplicate) {
        return { messageId: duplicate.id, runId: duplicate.requestedRuns[0]?.id ?? null };
      }
      throw error;
    }
    return { messageId, runId };
  }

  async run(ownerId: string, runId: string) {
    const run = await this.database.agentRun.findFirst({
      where: { id: runId, conversation: { ownerId } },
      select: {
        ...runSelect,
        assistantMessage: { select: messageSelect },
      },
    });
    if (!run) this.runNotFound();
    return run;
  }

  async retry(ownerId: string, runId: string, correlationId: string) {
    const run = await this.run(ownerId, runId);
    if (!["FAILED", "EXPIRED", "CANCELLED"].includes(run.status)) {
      throw new ApiException(
        "AGENT_RETRY_NOT_ALLOWED",
        "Only a failed, expired, or cancelled run can be retried.",
        HttpStatus.CONFLICT,
      );
    }
    await this.enforceQuota(ownerId, run.projectId);
    const project = await this.database.project.findUniqueOrThrow({
      where: { id: run.projectId },
      select: { analysisProfile: true, profileVersion: true },
    });
    const nextId = randomUUID();
    const next = await this.database.inTransaction(async (transaction) => {
      const created = await transaction.agentRun.create({
        data: {
          id: nextId,
          conversationId: run.conversationId,
          userMessageId: run.userMessageId,
          projectId: run.projectId,
          analysisId: run.analysisId,
          analysisProfile: project.analysisProfile,
          profileVersion: project.profileVersion,
          maxAttempts: Number(process.env.AGENT_MAX_ATTEMPTS ?? 3),
          deadlineAt: new Date(
            Date.now() + Number(process.env.AGENT_QUEUE_DEADLINE_SECONDS ?? 600) * 1000,
          ),
          correlationId,
        },
        select: runSelect,
      });
      await transaction.agentStep.create({
        data: {
          agentRunId: nextId,
          sequence: 1,
          nodeName: "queue",
          nodeVersion: "1",
          eventType: "run.queued",
          status: "COMPLETED",
          safeSummary: "Evidence run queued.",
          metadata: { retryOfRunId: runId },
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: ownerId,
          projectId: run.projectId,
          analysisId: run.analysisId,
          eventType: "AGENT_RUN_RETRIED",
          correlationId,
          metadata: { priorRunId: runId, runId: nextId },
        },
      });
      return created;
    });
    return next;
  }

  async cancel(ownerId: string, runId: string) {
    const run = await this.run(ownerId, runId);
    if (["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(run.status)) return run;
    await this.database.agentRun.update({
      where: { id: runId },
      data: {
        cancellationRequested: true,
        ...(run.status === "QUEUED"
          ? {
              status: "CANCELLED",
              completedAt: new Date(),
              failureCode: "AGENT_CANCELLED",
            }
          : {}),
      },
    });
    await this.audit(ownerId, run.projectId, "AGENT_RUN_CANCEL_REQUESTED", { runId });
    return this.run(ownerId, runId);
  }

  async steps(ownerId: string, runId: string, afterSequence = 0) {
    await this.run(ownerId, runId);
    return this.database.agentStep.findMany({
      where: { agentRunId: runId, sequence: { gt: afterSequence } },
      select: {
        sequence: true,
        nodeName: true,
        eventType: true,
        status: true,
        safeSummary: true,
        reasonCode: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { sequence: "asc" },
      take: 100,
    });
  }

  private async enforceQuota(ownerId: string, projectId: string) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const [dailyMessages, activeRuns, usage] = await Promise.all([
      this.database.message.count({
        where: { authorId: ownerId, role: "USER", createdAt: { gte: since } },
      }),
      this.database.agentRun.count({
        where: {
          conversation: { ownerId },
          status: { in: ["QUEUED", "RUNNING", "VERIFYING"] },
        },
      }),
      this.database.agentRun.aggregate({
        where: { conversation: { ownerId }, createdAt: { gte: since } },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      }),
    ]);
    const tokenTotal = (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0);
    const costTotal = Number(usage._sum.estimatedCostUsd ?? 0);
    if (
      dailyMessages >= Number(process.env.AGENT_MAX_MESSAGES_PER_DAY ?? 20) ||
      tokenTotal >= Number(process.env.AGENT_MAX_TOKENS_PER_DAY ?? 100_000) ||
      costTotal >= Number(process.env.AGENT_MAX_COST_USD_PER_DAY ?? 0.25)
    ) {
      throw new ApiException(
        "AGENT_RATE_LIMITED",
        "The daily Evidence Copilot allowance has been reached.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (activeRuns >= 1) {
      throw new ApiException(
        "AGENT_CONCURRENCY_LIMIT",
        "Wait for the active Evidence Copilot run to finish.",
        HttpStatus.CONFLICT,
      );
    }
    await this.requireProject(ownerId, projectId);
  }

  private async requireProject(ownerId: string, projectId: string) {
    const exists = await this.database.project.count({ where: { id: projectId, ownerId } });
    if (!exists) this.notFound();
  }

  private audit(
    actorId: string,
    projectId: string,
    eventType: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.database.auditEvent.create({
      data: { actorId, projectId, eventType, correlationId: randomUUID(), metadata },
    });
  }

  private notFound(): never {
    throw new ApiException(
      "CONVERSATION_NOT_FOUND",
      "The conversation was not found.",
      HttpStatus.NOT_FOUND,
    );
  }

  private runNotFound(): never {
    throw new ApiException(
      "AGENT_RUN_NOT_FOUND",
      "The agent run was not found.",
      HttpStatus.NOT_FOUND,
    );
  }
}
