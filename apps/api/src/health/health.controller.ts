import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@plandelta/contracts";

@Controller("health")
export class HealthController {
  @Get("live")
  live(): HealthResponse {
    return { service: "api", status: "ok", version: "0.1.0" };
  }

  @Get("ready")
  ready(): HealthResponse {
    return { service: "api", status: "ok", version: "0.1.0" };
  }
}
