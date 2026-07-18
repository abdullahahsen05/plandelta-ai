import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";

const repositoryRoot = resolve(import.meta.dirname, "..");
const parsed = loadDotenv({
  path: resolve(repositoryRoot, ".env.local"),
  quiet: true,
  processEnv: {},
}).parsed;

if (!parsed) throw new Error("The ignored .env.local file could not be loaded.");

const required = ["DATABASE_URL", "JWT_AUDIENCE", "JWT_ISSUER", "INTERNAL_SERVICE_SECRET"];
const missing = required.filter((name) => !parsed[name]?.trim());
if (missing.length) throw new Error(`Missing required production variables: ${missing.join(", ")}`);

const region = process.env.PLANDELTA_AWS_REGION?.trim() || "us-east-1";
const bucket = process.env.PLANDELTA_S3_BUCKET?.trim();
const webOrigin = process.env.PLANDELTA_WEB_ORIGIN?.trim() || "https://plandelta-ai.vercel.app";
if (!bucket) throw new Error("Missing required deployment variable: PLANDELTA_S3_BUCKET");

const apiValues = {
  APP_ENV: "production",
  DATABASE_URL: parsed.DATABASE_URL,
  JWT_AUDIENCE: parsed.JWT_AUDIENCE,
  JWT_ISSUER: parsed.JWT_ISSUER,
  INTERNAL_SERVICE_SECRET: parsed.INTERNAL_SERVICE_SECRET,
  LOG_LEVEL: "info",
  WEB_ORIGINS: webOrigin,
  STORAGE_PROVIDER: "s3",
  AWS_REGION: region,
  S3_REGION: region,
  S3_BUCKET: bucket,
  S3_PREFIX: "plandelta",
  S3_SIGNED_URL_TTL_SECONDS: "300",
  LOCAL_STORAGE_ROOT: "/data",
  SUMMARY_PROVIDER: "bedrock",
  BEDROCK_REGION: region,
  BEDROCK_MODEL_ID: "amazon.nova-micro-v1:0",
  BEDROCK_MAX_OUTPUT_TOKENS: "600",
  BEDROCK_MAX_INPUT_CHARACTERS: "12000",
  BEDROCK_TIMEOUT_MS: "30000",
  BEDROCK_MAX_ATTEMPTS: "2",
  WORKER_CONCURRENCY: "1",
  WORKER_ID: "production-worker-1",
  JOB_LEASE_SECONDS: "300",
  JOB_MAX_ATTEMPTS: "3",
  VISION_TIMEOUT_SECONDS: "240",
  MAX_UPLOAD_BYTES: "20971520",
  MAX_PDF_PAGES: "50",
  MAX_IMAGE_PIXELS: "60000000",
};
const visionValues = {
  APP_ENV: "production",
  INTERNAL_SERVICE_SECRET: parsed.INTERNAL_SERVICE_SECRET,
  LOG_LEVEL: "info",
  MAX_IMAGE_PIXELS: "60000000",
};

function environmentLine(name, value) {
  if (value === undefined) throw new Error(`Missing required production variable: ${name}`);
  if (/[\r\n]/.test(value)) throw new Error(`Production variable ${name} contains a newline.`);
  return `${name}=${value}`;
}

function encodeEnvironment(values) {
  return Buffer.from(
    `${Object.entries(values)
      .map(([name, value]) => environmentLine(name, value))
      .join("\n")}\n`,
    "utf8",
  ).toString("base64");
}

const bundle = {
  api: encodeEnvironment(apiValues),
  vision: encodeEnvironment(visionValues),
};
const encoded = Buffer.from(JSON.stringify(bundle), "utf8").toString("base64");

process.stdout.write(encoded);
