import { describe, expect, it } from "vitest";

import { resolveLiveProcessingEnabled } from "../lib/live-processing";

describe("live processing availability", () => {
  it("fails closed in production when no explicit value is configured", () => {
    expect(resolveLiveProcessingEnabled(undefined, true)).toBe(false);
    expect(resolveLiveProcessingEnabled(undefined, false)).toBe(true);
  });

  it("accepts only explicit enabled values", () => {
    expect(resolveLiveProcessingEnabled("true", true)).toBe(true);
    expect(resolveLiveProcessingEnabled("YES", true)).toBe(true);
    expect(resolveLiveProcessingEnabled("false", false)).toBe(false);
    expect(resolveLiveProcessingEnabled("unexpected", false)).toBe(false);
  });
});
