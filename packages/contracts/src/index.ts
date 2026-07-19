import { z } from "zod";

export { normalizedBoxSchema, type NormalizedBox } from "./geometry.js";

export const analysisStatusSchema = z.enum([
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
]);

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

export const healthResponseSchema = z.object({
  service: z.string().min(1),
  status: z.enum(["ok", "degraded"]),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).default({}),
    correlationId: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export * from "./agentic.js";
