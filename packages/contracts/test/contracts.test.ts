import { describe, expect, it } from "vitest";

import { healthResponseSchema, normalizedBoxSchema } from "../src/index.js";

describe("shared contracts", () => {
  it("accepts a normalized evidence box", () => {
    expect(normalizedBoxSchema.parse({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });

  it("rejects geometry outside the drawing", () => {
    expect(() => normalizedBoxSchema.parse({ x: 0.9, y: 0.2, width: 0.3, height: 0.4 })).toThrow(
      "horizontal boundary",
    );
  });

  it("requires a versioned health response", () => {
    expect(
      healthResponseSchema.safeParse({ service: "api", status: "ok", version: "0.1.0" }).success,
    ).toBe(true);
  });
});
