import { z } from "zod";

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

export const normalizedBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(({ x, width }) => x + width <= 1, "Box exceeds the horizontal boundary")
  .refine(({ y, height }) => y + height <= 1, "Box exceeds the vertical boundary");

export type NormalizedBox = z.infer<typeof normalizedBoxSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).default({}),
    correlationId: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
