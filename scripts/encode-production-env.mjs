import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";

const repositoryRoot = resolve(import.meta.dirname, "..");
const parsed = loadDotenv({
  path: resolve(repositoryRoot, ".env.local"),
  quiet: true,
  processEnv: {},
}).parsed;

if (!parsed) throw new Error("The ignored .env.local file could not be loaded.");

const required = [
  "AGENT_INTERNAL_TOKEN",
  "DATABASE_URL",
  "JWT_AUDIENCE",
  "JWT_ISSUER",
  "INTERNAL_SERVICE_SECRET",
];
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
  AGENT_INTERNAL_TOKEN: parsed.AGENT_INTERNAL_TOKEN,
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
const agentValues = {
  AGENT_INTERNAL_TOKEN: parsed.AGENT_INTERNAL_TOKEN,
  AGENT_CHAT_PROVIDER: "bedrock",
  AGENT_EMBEDDING_PROVIDER: "local",
  AGENT_EMBEDDING_MODEL: "BAAI/bge-small-en-v1.5",
  AGENT_EMBEDDING_DIMENSION: "384",
  AGENT_MAX_MODEL_TURNS: "8",
  AGENT_MAX_TOOL_CALLS: "12",
  AGENT_MAX_RETRIEVED_CHUNKS: "12",
  AGENT_MAX_REPAIR_PASSES: "1",
  AGENT_RUN_TIMEOUT_SECONDS: "60",
  AGENT_MAX_ESTIMATED_COST_USD: "0.02",
  AGENT_WORKER_CONCURRENCY: "1",
  AGENT_TRACE_CONTENT_ENABLED: "false",
  DATABASE_URL: parsed.DATABASE_URL,
  STORAGE_PROVIDER: "s3",
  AWS_REGION: region,
  S3_REGION: region,
  S3_BUCKET: bucket,
  S3_PREFIX: "plandelta",
  BEDROCK_REGION: region,
  BEDROCK_MODEL_ID: "amazon.nova-micro-v1:0",
  INTERNAL_SERVICE_SECRET: parsed.INTERNAL_SERVICE_SECRET,
  KNOWLEDGE_MAX_FILE_BYTES: "20971520",
  KNOWLEDGE_MAX_PAGES: "100",
  KNOWLEDGE_CHUNK_SIZE: "1200",
  KNOWLEDGE_CHUNK_OVERLAP: "180",
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
  agent: encodeEnvironment(agentValues),
  api: encodeEnvironment(apiValues),
  vision: encodeEnvironment(visionValues),
};
const encoded = Buffer.from(JSON.stringify(bundle), "utf8").toString("base64");

process.stdout.write(encoded);
