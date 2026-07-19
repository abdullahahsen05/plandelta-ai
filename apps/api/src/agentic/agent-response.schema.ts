import { z } from "zod";

const normalizedBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
});

const citationTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("visual_change"),
    analysisId: z.string().uuid(),
    changeId: z.string().uuid(),
    artifactId: z.string().uuid().nullable().default(null),
    region: normalizedBoxSchema.nullable().default(null),
  }),
  z.object({
    type: z.literal("document_chunk"),
    documentId: z.string().uuid(),
    documentVersionId: z.string().uuid(),
    chunkId: z.string().uuid(),
    page: z.number().int().positive(),
    section: z.string().max(240).nullable().default(null),
    excerpt: z.string().min(1).max(1200),
    isActive: z.boolean(),
    isConflicting: z.boolean(),
  }),
]);

const citationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  label: z.string().min(1).max(120),
  displayOrder: z.number().int().positive(),
  target: citationTargetSchema,
  supportsClaimIds: z.array(z.string().max(120)).max(40),
  verified: z.boolean(),
});

const answerSchema = z.object({
  status: z.enum(["verified", "conflicting_evidence", "insufficient_evidence"]),
  answerMarkdown: z.string().min(1).max(12_000),
  confidence: z.enum(["high", "medium", "low", "insufficient"]),
  warnings: z.array(z.string().max(500)).max(20),
  citations: z.array(citationSchema).max(30),
  rfiDraft: z
    .object({
      subject: z.string().min(1).max(200),
      question: z.string().min(1).max(3000),
      observedConflictOrChange: z.string().min(1).max(3000),
      requestedClarification: z.string().min(1).max(2000),
      impactIfUnresolved: z.string().min(1).max(2000),
      citationIds: z.array(z.string().uuid()).min(1).max(20),
      status: z.literal("draft_requires_human_review"),
      disclaimer: z.string().min(1).max(200),
    })
    .nullable()
    .default(null),
  provider: z.enum(["bedrock", "deterministic"]),
  modelId: z.string().max(200).nullable().default(null),
  promptVersion: z.string().min(1).max(80),
});

export const agentExecutionResponseSchema = z.object({
  runId: z.string().uuid(),
  status: z.literal("completed"),
  result: z.object({
    answer: answerSchema,
    verifier: z.object({
      approved: z.boolean(),
      reasonCodes: z.array(z.string().max(120)).max(30),
      invalidClaimIds: z.array(z.string().max(120)).max(40),
      invalidCitationIds: z.array(z.string().uuid()).max(40),
      repairable: z.boolean(),
    }),
    selectedSpecialists: z.array(z.enum(["visual", "knowledge", "impact"])).max(3),
    trace: z.array(z.unknown()).max(100),
    modelTurns: z.number().int().min(0).max(8),
    toolCalls: z.number().int().min(0).max(12),
    retrievedChunks: z.number().int().min(0).max(12),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().min(0).max(0.02),
    repairPasses: z.number().int().min(0).max(1),
    safeError: z
      .object({
        code: z.string().min(1).max(100),
        message: z.string().min(1).max(240),
        retryable: z.boolean(),
      })
      .nullable()
      .default(null),
  }),
});

export type AgentExecutionResponse = z.infer<typeof agentExecutionResponseSchema>;
