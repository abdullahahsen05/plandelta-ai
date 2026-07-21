import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";

loadDotenv({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });

const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").origin;
const supabaseOrigin = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
).origin;
const supabaseWebSocketOrigin = supabaseOrigin.replace(/^http/, "ws");
const scriptSource =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline'";
const contentSecurityPolicy = [
  "base-uri 'self'",
  `connect-src 'self' ${apiOrigin} ${supabaseOrigin} ${supabaseWebSocketOrigin}`,
  "default-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' blob: data:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  scriptSource,
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.PLANDELTA_WEB_DIST_DIR ?? ".next",
  async headers() {
    return [
      {
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=(self)",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
        source: "/(.*)",
      },
    ];
  },
  images: {
    remotePatterns: [],
  },
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@plandelta/contracts", "@plandelta/ui"],
  turbopack: {
    root: resolve(import.meta.dirname, "../.."),
  },
};

export default nextConfig;
