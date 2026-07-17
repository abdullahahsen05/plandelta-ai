import { apiErrorSchema } from "@plandelta/contracts";
import type { z } from "zod";

function apiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error("Missing required public environment variable: NEXT_PUBLIC_API_URL");
  return value.replace(/\/$/, "");
}

export class PlanDeltaApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlanDeltaApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("x-correlation-id", crypto.randomUUID());
  if (init.body && !(init.body instanceof FormData))
    headers.set("content-type", "application/json");
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(payload);
    throw new PlanDeltaApiError(
      parsed.success ? parsed.data.error.code : "REQUEST_FAILED",
      parsed.success ? parsed.data.error.message : "The request could not be completed.",
      response.status,
    );
  }
  return schema.parse(await response.json());
}

export async function apiRequestEmpty(path: string, accessToken: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("x-correlation-id", crypto.randomUUID());
  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok)
    throw new PlanDeltaApiError("REQUEST_FAILED", "The request failed.", response.status);
}

export function publicApiUrl(path: string) {
  return `${apiBaseUrl()}${path}`;
}
