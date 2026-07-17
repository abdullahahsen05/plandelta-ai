import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import type { AuthService } from "../src/auth/auth.service.js";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard.js";

function contextFor(request: { headers: { authorization?: string }; auth?: unknown }) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function reflectorReturning(value: boolean) {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(value),
  } as unknown as Reflector;
}

describe("JwtAuthGuard", () => {
  it("allows routes explicitly marked public without reading authorization", async () => {
    const verifyAccessToken = vi.fn();
    const authService = { verifyAccessToken } as unknown as AuthService;
    const guard = new JwtAuthGuard(reflectorReturning(true), authService);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects missing bearer credentials with a stable authorization error", async () => {
    const authService = { verifyAccessToken: vi.fn() } as unknown as AuthService;
    const guard = new JwtAuthGuard(reflectorReturning(false), authService);

    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("attaches verified identity context to authenticated requests", async () => {
    const identity = { userId: "00000000-0000-4000-8000-000000000001", role: "authenticated" };
    const authService = {
      verifyAccessToken: vi.fn().mockResolvedValue(identity),
    } as unknown as AuthService;
    const request: { headers: { authorization: string }; auth?: unknown } = {
      headers: { authorization: "Bearer verified-token" },
    };
    const guard = new JwtAuthGuard(reflectorReturning(false), authService);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.auth).toEqual(identity);
  });
});
