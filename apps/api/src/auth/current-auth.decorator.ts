import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AuthContext } from "./auth.types.js";

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.auth) throw new Error("Authenticated request context is missing.");
    return request.auth;
  },
);
