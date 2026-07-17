import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

type RateWindow = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RequestPolicyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestPolicyMiddleware.name);
  private readonly windows = new Map<string, RateWindow>();

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    this.applySecurityHeaders(response);
    this.applyTimeout(request, response);
    if (!this.allowRequest(request, response)) return;

    response.once("finish", () => {
      this.logger.log(
        JSON.stringify({
          event: "http_request",
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          correlationId: request.correlationId ?? "missing",
        }),
      );
    });
    next();
  }

  private applySecurityHeaders(response: Response) {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("cross-origin-opener-policy", "same-origin");
  }

  private applyTimeout(request: Request, response: Response) {
    const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000);
    request.setTimeout(timeoutMs);
    response.setTimeout(timeoutMs, () => {
      if (response.headersSent) {
        response.end();
        return;
      }
      response.status(503).json({
        error: {
          code: "REQUEST_TIMEOUT",
          message: "The request took too long. Try again.",
          details: {},
          correlationId: request.correlationId ?? "missing",
        },
      });
    });
  }

  private allowRequest(request: Request, response: Response) {
    if (request.path === "/health/live") return true;
    const now = Date.now();
    const readOnly = ["GET", "HEAD", "OPTIONS"].includes(request.method);
    const limit = Number(
      readOnly
        ? (process.env.RATE_LIMIT_READ_PER_MINUTE ?? 300)
        : (process.env.RATE_LIMIT_WRITE_PER_MINUTE ?? 60),
    );
    const key = `${request.ip}:${readOnly ? "read" : "write"}`;
    const existing = this.windows.get(key);
    const window =
      !existing || existing.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : existing;
    window.count += 1;
    this.windows.set(key, window);
    if (this.windows.size > 10_000) {
      for (const [candidate, value] of this.windows) {
        if (value.resetAt <= now) this.windows.delete(candidate);
      }
      while (this.windows.size > 10_000) {
        const oldest = this.windows.keys().next().value;
        if (!oldest) break;
        this.windows.delete(oldest);
      }
    }

    const remaining = Math.max(0, limit - window.count);
    const resetSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
    response.setHeader("ratelimit-limit", limit);
    response.setHeader("ratelimit-remaining", remaining);
    response.setHeader("ratelimit-reset", resetSeconds);
    if (window.count <= limit) return true;

    response.setHeader("retry-after", resetSeconds);
    response.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Wait before trying again.",
        details: {},
        correlationId: request.correlationId ?? "missing",
      },
    });
    return false;
  }
}
