import { afterEach, describe, expect, it } from "vitest";

import { getPublicAppOrigin } from "../lib/app-origin";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
    return;
  }
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("getPublicAppOrigin", () => {
  it("normalizes a wildcard bind address for browser redirects", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://0.0.0.0:3000";

    expect(getPublicAppOrigin()).toBe("http://localhost:3000");
  });

  it("preserves a configured public deployment origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://plandelta.example.com/app/";

    expect(getPublicAppOrigin()).toBe("https://plandelta.example.com");
  });
});
