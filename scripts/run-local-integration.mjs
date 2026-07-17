import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";

const repositoryRoot = resolve(import.meta.dirname, "..");
loadDotenv({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const environment = {
  ...process.env,
  LOCAL_STORAGE_ROOT: "data",
  VISION_SHARED_ROOT: "data",
  VISION_SERVICE_URL: "http://127.0.0.1:8000",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
  WEB_ORIGINS: "http://127.0.0.1:3100,http://localhost:3100",
};
const python = resolve(repositoryRoot, ".venv", "Scripts", "python.exe");
const services = [];

function start(name, command, arguments_) {
  const child = spawn(command, arguments_, {
    cwd: repositoryRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const errors = [];
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    errors.push(text);
    if (errors.join("").length > 20_000) errors.shift();
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    errors.push(text);
    if (errors.join("").length > 20_000) errors.shift();
  });
  services.push({ name, child, errors });
  return child;
}

async function waitFor(url, name) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The service is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${name} did not become healthy within 60 seconds.`);
}

async function runVerification() {
  return new Promise((resolvePromise, reject) => {
    const verification = spawn(process.execPath, ["scripts/verify-local-journey.mjs"], {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    verification.once("error", reject);
    verification.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Local journey verifier exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function runPlaywright() {
  return new Promise((resolvePromise, reject) => {
    const testArguments = ["test"];
    if (process.argv.includes("--live-only")) testArguments.push("e2e/live-journey.spec.ts");
    const playwright = spawn(
      process.execPath,
      [resolve(repositoryRoot, "apps/web/node_modules/@playwright/test/cli.js"), ...testArguments],
      {
        cwd: resolve(repositoryRoot, "apps/web"),
        env: { ...environment, PLANDELTA_LIVE_E2E: "true" },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    playwright.once("error", reject);
    playwright.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Playwright exited with code ${code ?? "unknown"}.`));
    });
  });
}

try {
  start("vision", python, [
    "-m",
    "uvicorn",
    "plandelta_vision.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
    "--app-dir",
    "apps/vision",
  ]);
  start("api", process.execPath, ["apps/api/dist/main.js"]);
  start("worker", process.execPath, ["apps/api/dist/worker.js"]);
  await Promise.all([
    waitFor("http://127.0.0.1:8000/health/live", "vision"),
    waitFor("http://127.0.0.1:4000/health/live", "api"),
  ]);
  if (process.argv.includes("--playwright")) await runPlaywright();
  else await runVerification();
} catch (error) {
  for (const service of services) {
    if (service.errors.length)
      console.error(`[${service.name}] ${service.errors.join("").slice(-4000)}`);
  }
  throw error;
} finally {
  for (const { child } of services) {
    if (!child.killed) child.kill();
  }
}
