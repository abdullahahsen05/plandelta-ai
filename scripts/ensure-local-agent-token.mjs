import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const environmentPath = resolve(".env.local");
let source;
try {
  source = await readFile(environmentPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  source = "";
}

const tokenPattern = /^AGENT_INTERNAL_TOKEN=(.*)$/m;
const current = source.match(tokenPattern)?.[1]?.trim() ?? "";
if (current.length >= 32) {
  process.stdout.write("Local agent token is already configured.\n");
  process.exit(0);
}

const generated = randomBytes(48).toString("base64url");
const next = tokenPattern.test(source)
  ? source.replace(tokenPattern, `AGENT_INTERNAL_TOKEN=${generated}`)
  : `${source}${source && !source.endsWith("\n") ? "\n" : ""}AGENT_INTERNAL_TOKEN=${generated}\n`;

await writeFile(environmentPath, next, { encoding: "utf8", mode: 0o600 });
process.stdout.write("Generated a local internal-service token in ignored .env.local.\n");
