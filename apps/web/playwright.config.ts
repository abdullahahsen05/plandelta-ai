import { defineConfig, devices } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:3100";
const configuredBaseUrl = process.env.PLANDELTA_E2E_BASE_URL?.replace(/\/$/, "");
const baseUrl = configuredBaseUrl ?? localBaseUrl;
const localWebServer = {
  command: "pnpm exec next dev --port 3100",
  env: {
    NEXT_PUBLIC_APP_URL: localBaseUrl,
    PLANDELTA_WEB_DIST_DIR: ".next-e2e",
  },
  url: localBaseUrl,
  reuseExistingServer: false,
  timeout: 120_000,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: baseUrl,
    trace: "retain-on-failure",
  },
  ...(configuredBaseUrl ? {} : { webServer: localWebServer }),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
