import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../src/database/database.service.js";
import { HealthController } from "../src/health/health.controller.js";

describe("HealthController", () => {
  beforeEach(() => {
    vi.stubEnv("AGENT_ENABLED", "false");
    vi.stubEnv("INTERNAL_SERVICE_SECRET", "ci-internal-service-secret-000000");
    vi.stubEnv("JWT_AUDIENCE", "authenticated");
    vi.stubEnv("JWT_ISSUER", "https://example.supabase.co/auth/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports process liveness", () => {
    const database = { $queryRaw: vi.fn() } as unknown as DatabaseService;
    expect(new HealthController(database).live()).toEqual({
      service: "api",
      status: "ok",
      version: "0.1.0",
    });
  });

  it("reports readiness only when the database and vision service respond", async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as DatabaseService;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(new HealthController(database).ready()).resolves.toEqual({
      service: "api",
      status: "ok",
      version: "0.1.0",
      agent: "disabled",
      database: "ok",
      vision: "ok",
    });
  });

  it("returns a safe unavailable response when a dependency fails", async () => {
    const database = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("database details")),
    } as unknown as DatabaseService;

    await expect(new HealthController(database).ready()).rejects.toMatchObject({
      response: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "A required API dependency is unavailable.",
      },
      status: 503,
    });
  });
});
