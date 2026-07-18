import { randomUUID } from "node:crypto";

import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import { afterAll, describe, expect, it } from "vitest";

import { S3StorageProvider } from "../src/storage/s3-storage.provider.js";
import { BedrockSummaryProvider } from "../src/summary/bedrock-summary.provider.js";

const runIntegration = process.env.RUN_AWS_PROVIDER_INTEGRATION === "true";
const integrationSuite = runIntegration ? describe : describe.skip;

integrationSuite("AWS provider integration", () => {
  const region = process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  const s3Client = new S3Client({ region, maxAttempts: 2 });
  const bedrockClient = new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION ?? region,
    maxAttempts: 2,
  });

  afterAll(() => {
    s3Client.destroy();
    bedrockClient.destroy();
  });

  it("keeps an S3 object private through write, signed read, and cleanup", async () => {
    const storage = new S3StorageProvider(s3Client);
    const key = `integration/${randomUUID()}/provider-check.txt`;
    const bytes = Buffer.from("PlanDelta private provider verification.", "utf8");
    try {
      await expect(storage.write(key, bytes)).resolves.toEqual({
        key,
        byteSize: bytes.byteLength,
      });
      await expect(storage.exists(key)).resolves.toBe(true);
      await expect(storage.read(key)).resolves.toEqual(bytes);

      const reference = await storage.createReadReference(key, 60);
      expect(reference.kind).toBe("https");
      if (reference.kind !== "https") throw new Error("Expected a signed HTTPS reference.");
      const signedResponse = await fetch(reference.url, { redirect: "error" });
      expect(signedResponse.status).toBe(200);
      await expect(signedResponse.text()).resolves.toBe(bytes.toString("utf8"));

      const bucket = process.env.S3_BUCKET;
      const prefix = process.env.S3_PREFIX ?? "plandelta";
      if (!bucket) throw new Error("S3_BUCKET is required for AWS integration.");
      const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${prefix}/${key}`;
      const publicResponse = await fetch(publicUrl, { redirect: "manual" });
      expect(publicResponse.status).toBe(403);
    } finally {
      await storage.delete(key).catch(() => undefined);
    }
    await expect(storage.exists(key)).resolves.toBe(false);
  }, 30_000);

  it("returns a schema-valid on-demand Bedrock summary", async () => {
    const provider = new BedrockSummaryProvider(bedrockClient);
    const summary = await provider.summarizeAnalysis([
      {
        id: randomUUID(),
        sequence: 1,
        changeType: "ADDED",
        category: "WALL_LINEWORK",
        confidence: 0.87,
        oldText: "OPEN WORK AREA",
        newText: "CONFERENCE ROOM",
        affectedTrades: ["architectural", "electrical"],
        impact: "Review partition and power coordination.",
      },
    ]);

    expect(summary.provider).toBe("BEDROCK");
    expect(summary.modelId).toBe(process.env.BEDROCK_MODEL_ID);
    expect(summary.structuredSummary).toMatchObject({
      aiGenerated: true,
      counts: { ADDED: 1 },
    });
  }, 180_000);
});
