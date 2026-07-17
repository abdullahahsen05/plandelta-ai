import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const candidates =
  process.platform === "win32"
    ? [resolve(root, ".venv", "Scripts", "python.exe")]
    : [resolve(root, ".venv", "bin", "python")];

const python = candidates.find(existsSync);
if (!python) {
  console.error("Python virtual environment missing. Run: python -m venv .venv");
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), {
  cwd: root,
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
