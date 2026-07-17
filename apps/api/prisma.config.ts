import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadDotenv({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_DATABASE_URL"),
  },
});
