import { describe, expect, it, vi } from "vitest";

import { ConversationsService } from "../src/agentic/conversations.service.js";
import type { DatabaseService } from "../src/database/database.service.js";
import { expectApiError } from "./expect-api-error.js";

const ownerId = "00000000-0000-4000-8000-000000000101";
const otherOwnerId = "00000000-0000-4000-8000-000000000102";
const projectId = "00000000-0000-4000-8000-000000000103";
const conversationId = "00000000-0000-4000-8000-000000000104";
const messageId = "00000000-0000-4000-8000-000000000105";
const runId = "00000000-0000-4000-8000-000000000106";

describe("ConversationsService", () => {
  it("returns the original message and run for an idempotent retry", async () => {
    const database = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: conversationId,
          projectId,
          analysisId: null,
          status: "ACTIVE",
          project: { analysisProfile: "CONSTRUCTION_DRAWING", profileVersion: "1.0" },
        }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: messageId,
          requestedRuns: [{ id: runId }],
        }),
      },
    };
    const service = new ConversationsService(database as unknown as DatabaseService);

    await expect(
      service.createMessage(
        ownerId,
        conversationId,
        {
          content: "What changed?",
          idempotencyKey: "00000000-0000-4000-8000-000000000107",
        },
        "correlation",
      ),
    ).resolves.toEqual({ messageId, runId });
    expect(database.message.findFirst).toHaveBeenCalledTimes(1);
  });

  it("fails cross-user conversation access with the same safe not-found response", async () => {
    const database = {
      conversation: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new ConversationsService(database as unknown as DatabaseService);

    await expectApiError(
      service.get(otherOwnerId, conversationId),
      "CONVERSATION_NOT_FOUND",
      404,
    );
  });

  it("enforces one active agent run before creating another", async () => {
    const database = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: conversationId,
          projectId,
          analysisId: null,
          status: "ACTIVE",
          project: { analysisProfile: "CONSTRUCTION_DRAWING", profileVersion: "1.0" },
        }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
      },
      agentRun: {
        count: vi.fn().mockResolvedValue(1),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        }),
      },
    };
    const service = new ConversationsService(database as unknown as DatabaseService);

    await expectApiError(
      service.createMessage(
        ownerId,
        conversationId,
        {
          content: "What changed?",
          idempotencyKey: "00000000-0000-4000-8000-000000000108",
        },
        "correlation",
      ),
      "AGENT_CONCURRENCY_LIMIT",
      409,
    );
  });

  it("enforces the authenticated daily message allowance before model work", async () => {
    const database = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: conversationId,
          projectId,
          analysisId: null,
          status: "ACTIVE",
          project: { analysisProfile: "CONSTRUCTION_DRAWING", profileVersion: "1.0" },
        }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(20),
      },
      agentRun: {
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        }),
      },
    };
    const service = new ConversationsService(database as unknown as DatabaseService);

    await expectApiError(
      service.createMessage(
        ownerId,
        conversationId,
        {
          content: "What changed?",
          idempotencyKey: "00000000-0000-4000-8000-000000000109",
        },
        "correlation",
      ),
      "AGENT_RATE_LIMITED",
      429,
    );
  });
});
