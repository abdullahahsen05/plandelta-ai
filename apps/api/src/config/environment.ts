import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ path: resolve(import.meta.dirname, "../../../../.env.local"), quiet: true });

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  APP_ENV: z.enum(["local", "test", "preview", "production"]).default("local"),
  DATABASE_URL: z.string().url(),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ISSUER: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  WEB_ORIGINS: z.string().default("http://localhost:3000"),
  INTERNAL_SERVICE_SECRET: z.string().min(32),
  VISION_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  STORAGE_PROVIDER: z.literal("local").default("local"),
  LOCAL_STORAGE_ROOT: z.string().min(1).default("data"),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .default(20 * 1024 * 1024),
  MAX_PDF_PAGES: z.coerce.number().int().positive().max(200).default(50),
  MAX_IMAGE_PIXELS: z.coerce.number().int().positive().max(120_000_000).default(60_000_000),
  WORKER_ID: z.string().min(1).max(100).default("local-worker-1"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
  JOB_LEASE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  VISION_TIMEOUT_SECONDS: z.coerce.number().int().min(10).max(1800).default(240),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${names}`);
  }

  return result.data;
}
