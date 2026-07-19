import { describe, expect, it, vi } from "vitest";

import type { AgentExecutionResponse } from "../src/agentic/agent-response.schema.js";
import { AgentRunFinalizerService } from "../src/agentic/agent-run-finalizer.service.js";
import type { DatabaseService } from "../src/database/database.service.js";

const runId = "00000000-0000-4000-8000-000000000120";
const projectId = "00000000-0000-4000-8000-000000000121";
const ownerId = "00000000-0000-4000-8000-000000000122";
const conversationId = "00000000-0000-4000-8000-000000000123";
const citationId = "00000000-0000-4000-8000-000000000124";
const analysisId = "00000000-0000-4000-8000-000000000125";
const changeId = "00000000-0000-4000-8000-000000000126";

function execution(): AgentExecutionResponse {
  return {
    runId,
    status: "completed",
    result: {
      answer: {
        status: "verified",
        answerMarkdown: "One supported change was found. [1]",
        confidence: "high",
        warnings: [],
        citations: [
          {
            id: citationId,
            projectId,
            label: "Visual change 1",
            displayOrder: 1,
            target: {
              type: "visual_change",
              analysisId,
              changeId,
              artifactId: null,
              region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
            },
            supportsClaimIds: ["claim-1"],
            verified: true,
          },
        ],
        rfiDraft: null,
        provider: "bedrock",
        modelId: "amazon.nova-micro-v1:0",
        promptVersion: "agent-v1",
      },
      verifier: {
        approved: true,
        reasonCodes: [],
        invalidClaimIds: [],
        invalidCitationIds: [],
        repairable: false,
      },
      selectedSpecialists: ["visual"],
      trace: [],
      modelTurns: 2,
      toolCalls: 1,
      retrievedChunks: 0,
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      estimatedCostUsd: 0.0001,
      repairPasses: 0,
      safeError: null,
    },
  };
}

describe("AgentRunFinalizerService", () => {
  it("persists the assistant answer, verified citations, and terminal run atomically", async () => {
    const transaction = {
      agentRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: runId,
          conversationId,
          assistantMessageId: null,
          projectId,
          analysisId,
          cancellationRequested: false,
          correlationId: "finalizer-test",
          conversation: { ownerId },
        }),
        update: vi.fn().mockResolvedValue({ id: runId }),
      },
      message: { upsert: vi.fn().mockResolvedValue({ id: "assistant" }) },
      citation: { upsert: vi.fn().mockResolvedValue({ id: citationId }) },
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
    };
    const database = {
      inTransaction: vi.fn(
        async (operation: (client: typeof transaction) => Promise<void>) =>
          operation(transaction),
      ),
    };
    const service = new AgentRunFinalizerService(database as unknown as DatabaseService);

    await service.complete(runId, "worker", execution());

    expect(transaction.message.upsert).toHaveBeenCalledOnce();
    const citationCall: unknown = transaction.citation.upsert.mock.calls[0]?.[0];
    expect(citationCall).toMatchObject({
      create: {
          id: citationId,
          projectId,
          detectedChangeId: changeId,
          citationType: "VISUAL_CHANGE",
      },
    });
    const completedRunCall: unknown = transaction.agentRun.update.mock.calls[0]?.[0];
    expect(completedRunCall).toMatchObject({
      data: {
        status: "COMPLETED",
        verifierOutcome: "approved",
        leaseOwner: null,
      },
    });
  });

  it("honors cancellation before writing an assistant response", async () => {
    const transaction = {
      agentRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: runId,
          cancellationRequested: true,
        }),
        update: vi.fn().mockResolvedValue({ id: runId }),
      },
      message: { upsert: vi.fn() },
      citation: { upsert: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const database = {
      inTransaction: vi.fn(
        async (operation: (client: typeof transaction) => Promise<void>) =>
          operation(transaction),
      ),
    };
    const service = new AgentRunFinalizerService(database as unknown as DatabaseService);

    await service.complete(runId, "worker", execution());

    expect(transaction.message.upsert).not.toHaveBeenCalled();
    const cancelledRunCall: unknown = transaction.agentRun.update.mock.calls[0]?.[0];
    expect(cancelledRunCall).toMatchObject({
      data: {
        status: "CANCELLED",
        failureCode: "AGENT_CANCELLED",
      },
    });
  });
});
