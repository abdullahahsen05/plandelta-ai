import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { AuthService } from "./auth.service.js";
import { PUBLIC_ROUTE_KEY } from "./public.decorator.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const [scheme, token, extra] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token || extra) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "A valid bearer access token is required.",
      });
    }

    try {
      request.auth = await this.authService.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException({
        code: "AUTH_INVALID",
        message: "The access token is invalid or expired.",
      });
    }
  }
}
