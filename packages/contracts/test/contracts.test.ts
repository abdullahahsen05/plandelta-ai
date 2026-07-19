import { describe, expect, it } from "vitest";

import {
  analysisProfileSchema,
  citationTargetSchema,
  createMessageSchema,
  evidencePacketSchema,
  healthResponseSchema,
  normalizedBoxSchema,
  rfiDraftSchema,
  toolCallSchema,
  verifiedAnswerSchema,
} from "../src/index.js";

describe("shared contracts", () => {
  it("accepts a normalized evidence box", () => {
    expect(normalizedBoxSchema.parse({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });

  it("rejects geometry outside the drawing", () => {
    expect(() => normalizedBoxSchema.parse({ x: 0.9, y: 0.2, width: 0.3, height: 0.4 })).toThrow(
      "horizontal boundary",
    );
  });

  it("requires a versioned health response", () => {
    expect(
      healthResponseSchema.safeParse({ service: "api", status: "ok", version: "0.1.0" }).success,
    ).toBe(true);
  });
});

describe("agentic contracts", () => {
  it("accepts only the two verified analysis profiles", () => {
    expect(
      analysisProfileSchema.parse({
        id: "construction_drawing",
        version: "1.0",
        displayName: "Construction drawing",
      }).id,
    ).toBe("construction_drawing");

    expect(() =>
      analysisProfileSchema.parse({
        id: "arbitrary_image",
        version: "1.0",
        displayName: "Unsupported",
      }),
    ).toThrow();
  });

  it("requires citation targets to match one authorized target shape", () => {
    expect(
      citationTargetSchema.parse({
        type: "visual_change",
        analysisId: "11111111-1111-4111-8111-111111111111",
        changeId: "22222222-2222-4222-8222-222222222222",
        artifactId: null,
        region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      }).type,
    ).toBe("visual_change");

    expect(() =>
      citationTargetSchema.parse({
        type: "document_chunk",
        documentId: "11111111-1111-4111-8111-111111111111",
        documentVersionId: "22222222-2222-4222-8222-222222222222",
        chunkId: "33333333-3333-4333-8333-333333333333",
        changeId: "44444444-4444-4444-8444-444444444444",
        page: 1,
        section: null,
        excerpt: "Supported source text.",
        isActive: true,
        isConflicting: false,
      }),
    ).toThrow();
  });

  it("constrains messages, tool names, and specialist packets", () => {
    expect(
      createMessageSchema.parse({
        content: "Which revision changed the rated partition?",
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }).content,
    ).toContain("partition");

    expect(() =>
      toolCallSchema.parse({
        name: "run_shell",
        version: "1",
        arguments: {},
      }),
    ).toThrow();

    expect(
      evidencePacketSchema.parse({
        specialist: "knowledge",
        intent: "specification_lookup",
        evidence: [],
        warnings: ["No active specification matched."],
        insufficientEvidence: true,
      }).insufficientEvidence,
    ).toBe(true);
  });

  it("keeps RFI output explicitly review-only", () => {
    const draft = rfiDraftSchema.parse({
      subject: "Partition rating conflict",
      question: "Which requirement governs?",
      observedConflictOrChange: "Two active sources disagree.",
      requestedClarification: "Confirm the governing rating.",
      impactIfUnresolved: "Coordination may be delayed.",
      citationIds: ["11111111-1111-4111-8111-111111111111"],
      status: "draft_requires_human_review",
      disclaimer: "Draft — requires human review before use.",
    });

    expect(draft.status).toBe("draft_requires_human_review");
  });

  it("rejects a verified substantive answer without citations", () => {
    expect(() =>
      verifiedAnswerSchema.parse({
        status: "verified",
        answerMarkdown: "The partition rating changed.",
        confidence: "high",
        warnings: [],
        citations: [],
        rfiDraft: null,
        provider: "bedrock",
        modelId: "configured-model",
        promptVersion: "agent-v1",
      }),
    ).toThrow();
  });
});
