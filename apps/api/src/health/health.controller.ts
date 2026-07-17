import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import type { HealthResponse } from "@plandelta/contracts";

import { PublicRoute } from "../auth/public.decorator.js";
import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";

@Controller("health")
@PublicRoute()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get("live")
  live(): HealthResponse {
    return { service: "api", status: "ok", version: "0.1.0" };
  }

  @Get("ready")
  async ready(): Promise<HealthResponse & { database: "ok"; vision: "ok" }> {
    try {
      await this.database.$queryRaw(Prisma.sql`SELECT 1`);
      const visionUrl = (process.env.VISION_SERVICE_URL ?? "http://localhost:8000").replace(
        /\/$/,
        "",
      );
      const response = await fetch(`${visionUrl}/health/ready`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error("Vision readiness failed.");
      return {
        service: "api",
        status: "ok",
        version: "0.1.0",
        database: "ok",
        vision: "ok",
      };
    } catch {
      throw new ServiceUnavailableException({
        code: "DEPENDENCY_UNAVAILABLE",
        message: "A required API dependency is unavailable.",
      });
    }
  }
}
