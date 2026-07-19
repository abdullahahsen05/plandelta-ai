import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ path: resolve(import.meta.dirname, "../../../../.env.local"), quiet: true });

const environmentSchema = z
  .object({
    API_PORT: z.coerce.number().int().positive().default(4000),
    APP_ENV: z.enum(["local", "test", "preview", "production"]).default("local"),
    DATABASE_URL: z.string().url(),
    JWT_AUDIENCE: z.string().min(1),
    JWT_ISSUER: z.string().url(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    WEB_ORIGINS: z.string().default("http://localhost:3000"),
    INTERNAL_SERVICE_SECRET: z.string().min(32),
    AGENT_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AGENT_SERVICE_URL: z.string().url().default("http://agent:8100"),
    AGENT_INTERNAL_TOKEN: z.string().min(32).optional(),
    VISION_SERVICE_URL: z.string().url().default("http://localhost:8000"),
    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    LOCAL_STORAGE_ROOT: z.string().min(1).default("data"),
    AWS_REGION: z.string().min(1).default("us-east-1"),
    S3_REGION: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(3).optional(),
    S3_PREFIX: z.string().min(1).default("plandelta"),
    S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
    S3_MAX_READ_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(100 * 1024 * 1024)
      .default(50 * 1024 * 1024),
    SUMMARY_PROVIDER: z.enum(["deterministic", "bedrock"]).default("deterministic"),
    BEDROCK_REGION: z.string().min(1).optional(),
    BEDROCK_MODEL_ID: z.string().min(1).optional(),
    BEDROCK_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(1_200).default(600),
    BEDROCK_MAX_INPUT_CHARACTERS: z.coerce.number().int().min(4_000).max(30_000).default(12_000),
    BEDROCK_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    BEDROCK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(2).default(2),
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
    REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
    RATE_LIMIT_READ_PER_MINUTE: z.coerce.number().int().min(10).max(5000).default(300),
    RATE_LIMIT_WRITE_PER_MINUTE: z.coerce.number().int().min(5).max(1000).default(60),
    MAX_UPLOADS_PER_DAY: z.coerce.number().int().min(2).max(500).default(40),
    MAX_UPLOAD_BYTES_PER_DAY: z.coerce
      .number()
      .int()
      .min(20 * 1024 * 1024)
      .max(5 * 1024 * 1024 * 1024)
      .default(500 * 1024 * 1024),
    MAX_ANALYSES_PER_HOUR: z.coerce.number().int().min(1).max(100).default(12),
    MAX_ACTIVE_ANALYSES: z.coerce.number().int().min(1).max(10).default(3),
  })
  .superRefine((environment, context) => {
    if (environment.STORAGE_PROVIDER === "s3" && !environment.S3_BUCKET) {
      context.addIssue({
        code: "custom",
        path: ["S3_BUCKET"],
        message: "S3_BUCKET is required when STORAGE_PROVIDER=s3.",
      });
    }
    if (environment.SUMMARY_PROVIDER === "bedrock" && !environment.BEDROCK_MODEL_ID) {
      context.addIssue({
        code: "custom",
        path: ["BEDROCK_MODEL_ID"],
        message: "BEDROCK_MODEL_ID is required when SUMMARY_PROVIDER=bedrock.",
      });
    }
    if (environment.AGENT_ENABLED && !environment.AGENT_INTERNAL_TOKEN) {
      context.addIssue({
        code: "custom",
        path: ["AGENT_INTERNAL_TOKEN"],
        message: "AGENT_INTERNAL_TOKEN is required when AGENT_ENABLED=true.",
      });
    }
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
