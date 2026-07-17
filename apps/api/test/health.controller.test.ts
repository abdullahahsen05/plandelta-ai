import { describe, expect, it } from "vitest";

import { HealthController } from "../src/health/health.controller.js";

describe("HealthController", () => {
  it("reports process liveness", () => {
    expect(new HealthController().live()).toEqual({
      service: "api",
      status: "ok",
      version: "0.1.0",
    });
  });
});
