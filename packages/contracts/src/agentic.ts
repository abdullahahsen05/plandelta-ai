import { z } from "zod";

import { normalizedBoxSchema } from "./geometry.js";

const uuidSchema = z.uuid();
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const analysisProfileIdSchema = z.enum(["construction_drawing", "engineering_schematic"]);
export type AnalysisProfileId = z.infer<typeof analysisProfileIdSchema>;

export const analysisProfileSchema = z
  .object({
    id: analysisProfileIdSchema,
    version: z.string().min(1).max(40),
    displayName: z.string().min(1).max(120),
  })
  .strict();
export type AnalysisProfile = z.infer<typeof analysisProfileSchema>;

export const knowledgeDocumentTypeSchema = z.enum([
  "specification",
  "drawing_notes",
  "revision_narrative",
  "addendum",
  "boq_schedule",
  "rfi",
  "prior_report",
  "technical_note",
]);
export type KnowledgeDocumentType = z.infer<typeof knowledgeDocumentTypeSchema>;

export const knowledgeDocumentStatusSchema = z.enum([
  "uploaded",
  "extracting",
  "embedding",
  "ready",
  "failed",
  "deleted",
]);
export type KnowledgeDocumentStatus = z.infer<typeof knowledgeDocumentStatusSchema>;

export const ingestionJobStatusSchema = z.enum([
  "queued",
  "claimed",
  "extracting",
  "chunking",
  "embedding",
  "retrying",
  "completed",
  "failed",
  "cancelled",
]);
export type IngestionJobStatus = z.infer<typeof ingestionJobStatusSchema>;

export const knowledgeDocumentSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    originalFilename: z.string().min(1).max(255),
    detectedMimeType: z.enum(["application/pdf", "text/plain"]),
    documentType: knowledgeDocumentTypeSchema,
    status: knowledgeDocumentStatusSchema,
    activeVersionId: uuidSchema.nullable(),
    revisionLabel: z.string().max(120).nullable(),
    effectiveDate: z.iso.date().nullable(),
    pageCount: z.number().int().positive().nullable(),
    failureCode: z.string().min(1).max(100).nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;

export const ingestionProgressSchema = z
  .object({
    jobId: uuidSchema,
    documentId: uuidSchema,
    status: ingestionJobStatusSchema,
    progress: z.number().int().min(0).max(100),
    stage: z.string().min(1).max(80),
    attemptCount: z.number().int().min(0),
    maxAttempts: z.number().int().positive(),
    failureCode: z.string().min(1).max(100).nullable(),
  })
  .strict();
export type IngestionProgress = z.infer<typeof ingestionProgressSchema>;

export const sourceDocumentSchema = z
  .object({
    documentId: uuidSchema,
    documentVersionId: uuidSchema,
    chunkId: uuidSchema,
    filename: z.string().min(1).max(255),
    documentType: knowledgeDocumentTypeSchema,
    revisionLabel: z.string().max(120).nullable(),
    effectiveDate: z.iso.date().nullable(),
    page: z.number().int().positive(),
    section: z.string().max(240).nullable(),
    excerpt: z.string().min(1).max(1200),
    checksumSha256: sha256Schema,
    isActive: z.boolean(),
    isConflicting: z.boolean(),
    textScore: z.number().min(0).max(1),
    vectorScore: z.number().min(0).max(1),
    combinedScore: z.number().min(0).max(1),
  })
  .strict();
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

export const citationTargetSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("visual_change"),
      analysisId: uuidSchema,
      changeId: uuidSchema,
      artifactId: uuidSchema.nullable(),
      region: normalizedBoxSchema.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("document_chunk"),
      documentId: uuidSchema,
      documentVersionId: uuidSchema,
      chunkId: uuidSchema,
      page: z.number().int().positive(),
      section: z.string().max(240).nullable(),
      excerpt: z.string().min(1).max(1200),
      isActive: z.boolean(),
      isConflicting: z.boolean(),
    })
    .strict(),
]);
export type CitationTarget = z.infer<typeof citationTargetSchema>;

export const citationSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    label: z.string().min(1).max(120),
    displayOrder: z.number().int().positive(),
    target: citationTargetSchema,
    supportsClaimIds: z.array(z.string().min(1).max(80)).max(40),
    verified: z.boolean(),
  })
  .strict();
export type Citation = z.infer<typeof citationSchema>;

export const specialistRoleSchema = z.enum(["visual", "knowledge", "impact"]);
export type SpecialistRole = z.infer<typeof specialistRoleSchema>;

export const evidenceReferenceSchema = z
  .object({
    evidenceId: z.string().min(1).max(120),
    sourceType: z.enum(["visual_change", "document_chunk", "profile_rule"]),
    projectId: uuidSchema,
    analysisId: uuidSchema.nullable(),
    sourceId: uuidSchema.nullable(),
    summary: z.string().min(1).max(800),
    confidence: z.number().min(0).max(1),
    isActive: z.boolean(),
    isConflicting: z.boolean(),
    citationTarget: citationTargetSchema.nullable(),
  })
  .strict();
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export const evidencePacketSchema = z
  .object({
    specialist: specialistRoleSchema,
    intent: z.string().min(1).max(80),
    evidence: z.array(evidenceReferenceSchema).max(20),
    warnings: z.array(z.string().min(1).max(400)).max(20),
    insufficientEvidence: z.boolean(),
  })
  .strict();
export type EvidencePacket = z.infer<typeof evidencePacketSchema>;

export const rfiDraftSchema = z
  .object({
    subject: z.string().min(1).max(200),
    question: z.string().min(1).max(3000),
    observedConflictOrChange: z.string().min(1).max(3000),
    requestedClarification: z.string().min(1).max(2000),
    impactIfUnresolved: z.string().min(1).max(2000),
    citationIds: z.array(uuidSchema).min(1).max(20),
    status: z.literal("draft_requires_human_review"),
    disclaimer: z.literal("Draft — requires human review before use."),
  })
  .strict();
export type RfiDraft = z.infer<typeof rfiDraftSchema>;

export const agentConfidenceSchema = z.enum(["high", "medium", "low", "insufficient"]);
export type AgentConfidence = z.infer<typeof agentConfidenceSchema>;

export const verifiedAnswerSchema = z
  .object({
    status: z.enum(["verified", "conflicting_evidence", "insufficient_evidence"]),
    answerMarkdown: z.string().min(1).max(12_000),
    confidence: agentConfidenceSchema,
    warnings: z.array(z.string().min(1).max(500)).max(20),
    citations: z.array(citationSchema).max(30),
    rfiDraft: rfiDraftSchema.nullable(),
    provider: z.enum(["bedrock", "deterministic"]),
    modelId: z.string().min(1).max(200).nullable(),
    promptVersion: z.string().min(1).max(80),
  })
  .strict()
  .refine(
    (answer) =>
      answer.status !== "verified" ||
      answer.confidence === "insufficient" ||
      answer.citations.length > 0,
    "Verified substantive answers require citations",
  );
export type VerifiedAnswer = z.infer<typeof verifiedAnswerSchema>;

export const verifierResultSchema = z
  .object({
    approved: z.boolean(),
    reasonCodes: z.array(z.string().min(1).max(100)).max(30),
    invalidClaimIds: z.array(z.string().min(1).max(80)).max(40),
    invalidCitationIds: z.array(uuidSchema).max(40),
    repairable: z.boolean(),
  })
  .strict();
export type VerifierResult = z.infer<typeof verifierResultSchema>;

export const toolCallSchema = z
  .object({
    name: z.enum([
      "list_visual_changes",
      "get_visual_evidence",
      "hybrid_search",
      "get_source_page",
      "apply_profile_impact_rules",
      "calculate_evidence_quantity",
    ]),
    version: z.string().min(1).max(20),
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();
export type ToolCall = z.infer<typeof toolCallSchema>;

export const agentRunStatusSchema = z.enum([
  "queued",
  "running",
  "verifying",
  "completed",
  "failed",
  "cancelled",
  "expired",
]);
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;

export const agentRunEventTypeSchema = z.enum([
  "run.queued",
  "run.started",
  "run.status",
  "specialist.started",
  "specialist.completed",
  "tool.started",
  "tool.completed",
  "verification.started",
  "verification.repairing",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "heartbeat",
]);
export type AgentRunEventType = z.infer<typeof agentRunEventTypeSchema>;

export const agentRunEventSchema = z
  .object({
    runId: uuidSchema,
    sequence: z.number().int().positive(),
    type: agentRunEventTypeSchema,
    status: agentRunStatusSchema,
    message: z.string().min(1).max(240),
    timestamp: isoDateTimeSchema,
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict();
export type AgentRunEvent = z.infer<typeof agentRunEventSchema>;

export const createConversationSchema = z
  .object({
    analysisId: uuidSchema.nullable().optional(),
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict();
export type CreateConversation = z.infer<typeof createConversationSchema>;

export const createMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(4000),
    idempotencyKey: z.uuid(),
  })
  .strict();
export type CreateMessage = z.infer<typeof createMessageSchema>;

export const executeAgentRunSchema = z
  .object({
    runId: uuidSchema,
    correlationId: z.string().min(1).max(100),
  })
  .strict();
export type ExecuteAgentRun = z.infer<typeof executeAgentRunSchema>;
