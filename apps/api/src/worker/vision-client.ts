import { Injectable } from "@nestjs/common";
import { z } from "zod";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const artifactSchema = z.object({
  kind: z.enum([
    "BASELINE_RENDER",
    "CANDIDATE_RENDER",
    "ALIGNED_CANDIDATE",
    "OVERLAY",
    "ADDED_MASK",
    "REMOVED_MASK",
    "EVIDENCE_CROP",
    "REPORT",
  ]),
  storageKey: z.string().min(1).max(1024),
  mimeType: z.string().min(1).max(120),
  widthPx: z.number().int().positive().nullable().default(null),
  heightPx: z.number().int().positive().nullable().default(null),
  byteSize: z.number().int().positive().nullable().default(null),
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .default(null),
  metadata: z.record(z.string(), jsonValueSchema).default({}),
});

const changeSchema = z.object({
  sequence: z.number().int().positive(),
  changeType: z.enum(["ADDED", "REMOVED", "MODIFIED", "TEXT_CHANGED"]),
  category: z.enum([
    "WALL_LINEWORK",
    "DOOR",
    "WINDOW",
    "FIXTURE_SYMBOL",
    "DIMENSION",
    "TEXT_NOTE",
    "ROOM_LABEL",
    "COMPONENT",
    "CONNECTION_LINE",
    "LABEL",
    "NOTE",
    "UNKNOWN",
  ]),
  source: z.enum(["RULES", "ONNX", "OCR", "HYBRID"]),
  box: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  }),
  polygon: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      }),
    )
    .min(3)
    .nullable()
    .default(null),
  confidence: z.number().min(0).max(1),
  oldText: z.string().nullable().default(null),
  newText: z.string().nullable().default(null),
  textConfidence: z.number().min(0).max(1).nullable().default(null),
  affectedTrades: z.array(z.string().min(1).max(80)).default([]),
  quantityDelta: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  impact: z.string().nullable().default(null),
  evidence: z.record(z.string(), jsonValueSchema).default({}),
});

export const visionResultSchema = z.object({
  schemaVersion: z.string().min(1),
  engineVersion: z.string().min(1),
  analysisId: z.string().uuid(),
  alignment: z.object({
    method: z.string().min(1),
    confidence: z.number().min(0).max(1),
    reprojectionError: z.number().nonnegative(),
  }),
  metrics: z.record(z.string(), jsonValueSchema),
  warnings: z.array(z.string()),
  artifacts: z.array(artifactSchema),
  changes: z.array(changeSchema),
});

export type VisionResult = z.infer<typeof visionResultSchema>;

type VisionRequest = {
  analysisId: string;
  correlationId: string;
  baseline: { kind: "local"; path: string } | { kind: "https"; url: string };
  candidate: { kind: "local"; path: string } | { kind: "https"; url: string };
  selectedPage: number;
  analysisProfile: "construction_drawing" | "engineering_schematic";
  configuration: unknown;
  artifactOutput: { kind: "local"; prefix: string };
};

@Injectable()
export class VisionClient {
  async analyze(request: VisionRequest): Promise<VisionResult> {
    const serviceUrl = process.env.VISION_SERVICE_URL ?? "http://vision:8000";
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    if (!internalSecret) throw new Error("INTERNAL_SERVICE_SECRET is required by the worker.");

    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/internal/v1/analyses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service-secret": internalSecret,
        "x-correlation-id": request.correlationId,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(Number(process.env.VISION_TIMEOUT_SECONDS ?? 240) * 1000),
    });
    if (!response.ok) {
      throw new Error(`Vision service returned HTTP ${response.status}.`);
    }
    return visionResultSchema.parse(await response.json());
  }
}
