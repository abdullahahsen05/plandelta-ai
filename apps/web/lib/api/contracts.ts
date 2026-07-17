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
