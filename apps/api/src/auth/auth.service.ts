import { Injectable } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";

import type { AuthContext } from "./auth.types.js";

@Injectable()
export class AuthService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor() {
    const issuer = process.env.JWT_ISSUER;
    const audience = process.env.JWT_AUDIENCE;
    if (!issuer || !audience) {
      throw new Error("Invalid environment variables: JWT_ISSUER, JWT_AUDIENCE");
    }

    this.issuer = issuer.replace(/\/$/, "");
    this.audience = audience;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verifyAccessToken(token: string): Promise<AuthContext> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.audience,
    });

    if (!payload.sub || typeof payload.role !== "string") {
      throw new Error("The access token is missing required identity claims.");
    }

    const email = typeof payload.email === "string" ? payload.email : undefined;
    return {
      userId: payload.sub,
      role: payload.role,
      ...(email ? { email } : {}),
    };
  }
}
