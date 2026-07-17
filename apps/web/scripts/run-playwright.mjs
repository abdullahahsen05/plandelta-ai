import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const nextEnvironmentPath = new URL("../next-env.d.ts", import.meta.url);
const testBuildPath = new URL("../.next-e2e", import.meta.url);
const originalNextEnvironment = readFileSync(nextEnvironmentPath);
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");

let result;
try {
  rmSync(testBuildPath, { force: true, recursive: true });
  result = spawnSync(process.execPath, [playwrightCli, "test"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: process.env,
    stdio: "inherit",
  });
} finally {
  writeFileSync(nextEnvironmentPath, originalNextEnvironment);
}

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
