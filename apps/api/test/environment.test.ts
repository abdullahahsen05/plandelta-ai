import { describe, expect, it } from "vitest";

import { loadEnvironment } from "../src/config/environment.js";

const baseEnvironment = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/postgres",
  JWT_AUDIENCE: "authenticated",
  JWT_ISSUER: "https://example.supabase.co/auth/v1",
  INTERNAL_SERVICE_SECRET: "a".repeat(32),
};

describe("loadEnvironment", () => {
  it("keeps local storage as the safe default", () => {
    expect(loadEnvironment(baseEnvironment).STORAGE_PROVIDER).toBe("local");
  });

  it("requires a bucket for S3 storage", () => {
    expect(() => loadEnvironment({ ...baseEnvironment, STORAGE_PROVIDER: "s3" })).toThrow(
      "S3_BUCKET",
    );
    expect(
      loadEnvironment({
        ...baseEnvironment,
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "plandelta-private-test",
      }).S3_BUCKET,
    ).toBe("plandelta-private-test");
  });
});
