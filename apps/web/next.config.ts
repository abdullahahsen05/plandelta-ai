import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";

loadDotenv({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@plandelta/contracts", "@plandelta/ui"],
};

export default nextConfig;
