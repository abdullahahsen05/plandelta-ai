import { z } from "zod";

const dateString = z.string().min(1);

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectCode: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
  createdAt: dateString,
  updatedAt: dateString,
  _count: z.object({ revisions: z.number(), analyses: z.number() }).optional(),
});
export type Project = z.infer<typeof projectSchema>;

export const projectListSchema = z.object({
  items: z.array(projectSchema),
  nextCursor: z.string().nullable(),
});

export const revisionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  label: z.string(),
  revisionCode: z.string().nullable(),
  role: z.enum(["BASELINE", "CANDIDATE"]),
  originalName: z.string(),
  mimeType: z.string(),
  byteSize: z.number().nonnegative(),
  pageCount: z.number().int().positive(),
  selectedPage: z.number().int().positive().nullable(),
  widthPx: z.number().int().positive().nullable(),
  heightPx: z.number().int().positive().nullable(),
  uploadStatus: z.enum(["PENDING", "READY", "FAILED"]),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: dateString,
  updatedAt: dateString,
});
export type Revision = z.infer<typeof revisionSchema>;
export const revisionListSchema = z.array(revisionSchema);

export const analysisSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  baselineRevisionId: z.string().uuid(),
  candidateRevisionId: z.string().uuid(),
  status: z.enum([
    "QUEUED",
    "CLAIMED",
    "PREPROCESSING",
    "ALIGNING",
    "DIFFING",
    "OCR",
    "CLASSIFYING",
    "SUMMARIZING",
    "RETRYING",
    "COMPLETED",
    "FAILED",
  ]),
  progress: z.number().min(0).max(100),
  currentStage: z.string(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  startedAt: dateString.nullable(),
  completedAt: dateString.nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  schemaVersion: z.string(),
  engineVersion: z.string(),
  configuration: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()),
  summaryProvider: z.string(),
  createdAt: dateString,
  updatedAt: dateString,
});
export type Analysis = z.infer<typeof analysisSchema>;

export const analysisListSchema = z.object({
  items: z.array(analysisSchema),
  nextCursor: z.string().nullable(),
});

export const changeSchema = z.object({
  id: z.string().uuid(),
  analysisId: z.string().uuid(),
  sequence: z.number().int().positive(),
  changeType: z.enum(["ADDED", "REMOVED", "MODIFIED", "TEXT_CHANGED"]),
  category: z.string(),
  source: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  confidence: z.number(),
  oldText: z.string().nullable(),
  newText: z.string().nullable(),
  textConfidence: z.number().nullable(),
  affectedTrades: z.array(z.string()),
  impact: z.string().nullable(),
  evidence: z.record(z.string(), z.unknown()),
});
export type DetectedChange = z.infer<typeof changeSchema>;

export const changeListSchema = z.object({
  items: z.array(changeSchema),
  nextCursor: z.number().nullable(),
});

export const artifactSchema = z.object({
  id: z.string().uuid(),
  analysisId: z.string().uuid(),
  kind: z.string(),
  mimeType: z.string(),
  widthPx: z.number().int().positive().nullable(),
  heightPx: z.number().int().positive().nullable(),
  byteSize: z.number().nonnegative().nullable(),
  checksumSha256: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: dateString,
});
export type Artifact = z.infer<typeof artifactSchema>;
export const artifactListSchema = z.array(artifactSchema);

export const reportSchema = z.object({
  id: z.string().uuid(),
  analysisId: z.string().uuid(),
  executiveSummary: z.string(),
  structuredSummary: z.record(z.string(), z.unknown()),
  provider: z.string(),
  modelId: z.string().nullable(),
  promptVersion: z.string().nullable(),
  generatedAt: dateString,
  updatedAt: dateString,
});
export type AnalysisReport = z.infer<typeof reportSchema>;

const knowledgeDocumentTypeSchema = z.enum([
  "SPECIFICATION",
  "DRAWING_NOTES",
  "REVISION_NARRATIVE",
  "ADDENDUM",
  "BOQ_SCHEDULE",
  "RFI",
  "PRIOR_REPORT",
  "TECHNICAL_NOTE",
]);

const ingestionJobSchema = z.object({
  id: z.string().uuid(),
  documentVersionId: z.string().uuid().nullable(),
  status: z.enum([
    "QUEUED",
    "CLAIMED",
    "EXTRACTING",
    "CHUNKING",
    "EMBEDDING",
    "RETRYING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ]),
  progress: z.number().int().min(0).max(100),
  currentStage: z.string(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  failureCode: z.string().nullable(),
  createdAt: dateString,
  updatedAt: dateString,
  completedAt: dateString.nullable(),
});

export const knowledgeDocumentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  originalName: z.string(),
  detectedMimeType: z.enum(["application/pdf", "text/plain"]),
  byteSize: z.number().nonnegative(),
  checksumSha256: z.string(),
  documentType: knowledgeDocumentTypeSchema,
  status: z.enum(["UPLOADED", "EXTRACTING", "EMBEDDING", "READY", "FAILED", "DELETED"]),
  failureCode: z.string().nullable(),
  createdAt: dateString,
  updatedAt: dateString,
  activeVersion: z
    .object({
      id: z.string().uuid(),
      revisionLabel: z.string().nullable(),
      effectiveDate: dateString.nullable(),
      pageCount: z.number().int().positive().nullable(),
      extractedCharacterCount: z.number().int().nonnegative().nullable(),
      parserName: z.string(),
      parserVersion: z.string(),
      chunkerVersion: z.string(),
      embeddingProvider: z.string(),
      embeddingModel: z.string(),
      embeddingDimension: z.number().int().positive(),
      status: z.string(),
      completedAt: dateString.nullable(),
    })
    .nullable(),
  ingestionJobs: z.array(ingestionJobSchema).max(1),
});
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;
export const knowledgeDocumentListSchema = z.array(knowledgeDocumentSchema);

const agentRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

const citationSchema = z.object({
  id: z.string().uuid(),
  displayOrder: z.number().int().positive(),
  citationType: z.enum(["VISUAL_CHANGE", "DOCUMENT_CHUNK"]),
  label: z.string(),
  supportsClaimIds: z.array(z.string()),
  analysisId: z.string().uuid().nullable(),
  detectedChangeId: z.string().uuid().nullable(),
  artifactId: z.string().uuid().nullable(),
  normalizedRegion: z.record(z.string(), z.unknown()).nullable(),
  knowledgeDocumentId: z.string().uuid().nullable(),
  knowledgeVersionId: z.string().uuid().nullable(),
  knowledgeChunkId: z.string().uuid().nullable(),
  pageNumber: z.number().int().positive().nullable(),
  sectionTitle: z.string().nullable(),
  excerpt: z.string().nullable(),
  verifiedAt: dateString,
});
export type EvidenceCitation = z.infer<typeof citationSchema>;

const rfiDraftSchema = z
  .object({
    subject: z.string(),
    question: z.string(),
    observedConflictOrChange: z.string(),
    requestedClarification: z.string(),
    impactIfUnresolved: z.string(),
    citationIds: z.array(z.string().uuid()),
    status: z.literal("draft_requires_human_review"),
    disclaimer: z.string(),
  })
  .nullable();

export const copilotMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  messageType: z.enum(["QUESTION", "ANSWER", "RFI_DRAFT", "SYSTEM_NOTICE"]),
  status: z.enum(["PENDING", "STREAMING", "COMPLETED", "FAILED", "REFUSED"]),
  content: z.string(),
  answerStatus: z
    .enum(["verified", "conflicting_evidence", "insufficient_evidence"])
    .nullable(),
  confidence: z.enum(["high", "medium", "low", "insufficient"]).nullable(),
  rfiDraft: rfiDraftSchema,
  provider: z.string().nullable(),
  modelId: z.string().nullable(),
  promptVersion: z.string().nullable(),
  warnings: z.array(z.string()),
  createdAt: dateString,
  updatedAt: dateString,
  citations: z.array(citationSchema),
  requestedRuns: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: agentRunStatusSchema,
        failureCode: z.string().nullable(),
        cancellationRequested: z.boolean(),
        createdAt: dateString,
        updatedAt: dateString,
      }),
    )
    .max(1)
    .optional(),
});
export type CopilotMessage = z.infer<typeof copilotMessageSchema>;
export const copilotMessageListSchema = z.array(copilotMessageSchema);

export const conversationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  analysisId: z.string().uuid().nullable(),
  title: z.string(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
  createdAt: dateString,
  updatedAt: dateString,
  _count: z.object({ messages: z.number(), runs: z.number() }),
});
export type EvidenceConversation = z.infer<typeof conversationSchema>;
export const conversationListSchema = z.array(conversationSchema);

export const createMessageResultSchema = z.object({
  messageId: z.string().uuid(),
  runId: z.string().uuid().nullable(),
});

export const agentRunSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userMessageId: z.string().uuid(),
  assistantMessageId: z.string().uuid().nullable(),
  projectId: z.string().uuid(),
  analysisId: z.string().uuid().nullable(),
  status: agentRunStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  cancellationRequested: z.boolean(),
  selectedSpecialists: z.array(z.string()),
  modelTurnCount: z.number().int().nonnegative(),
  toolCallCount: z.number().int().nonnegative(),
  retrievedChunkCount: z.number().int().nonnegative(),
  repairCount: z.number().int().nonnegative(),
  verifierOutcome: z.string().nullable(),
  failureCode: z.string().nullable(),
  correlationId: z.string(),
  createdAt: dateString,
  startedAt: dateString.nullable(),
  completedAt: dateString.nullable(),
  updatedAt: dateString,
  assistantMessage: copilotMessageSchema.nullable().optional(),
});
export type AgentRun = z.infer<typeof agentRunSchema>;

export const visualCitationSourceSchema = z.object({
  type: z.literal("visual_change"),
  analysisId: z.string().uuid().nullable(),
  changeId: z.string().uuid().nullable(),
  changeSequence: z.number().int().positive().nullable(),
  artifactId: z.string().uuid().nullable(),
  region: z.record(z.string(), z.unknown()).nullable(),
});

export const documentCitationSourceSchema = z.object({
  type: z.literal("document_chunk"),
  documentId: z.string().uuid().nullable(),
  documentName: z.string(),
  documentStatus: z.string().nullable(),
  documentVersionId: z.string().uuid().nullable(),
  revisionLabel: z.string().nullable(),
  effectiveDate: dateString.nullable(),
  chunkId: z.string().uuid().nullable(),
  page: z.number().int().positive().nullable(),
  section: z.string().nullable(),
  excerpt: z.string().nullable(),
});

export const citationSourceSchema = z.discriminatedUnion("type", [
  visualCitationSourceSchema,
  documentCitationSourceSchema,
]);
export type CitationSource = z.infer<typeof citationSourceSchema>;

export const copilotCapabilitiesSchema = z.object({
  available: z.boolean(),
  provider: z.enum(["bedrock", "offline"]),
});
