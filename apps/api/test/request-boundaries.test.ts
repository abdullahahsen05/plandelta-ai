import { StreamableFile, type CallHandler, type ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { CorrelationMiddleware } from "../src/common/correlation.middleware.js";
import { JsonResponseInterceptor } from "../src/common/json-response.interceptor.js";

describe("request boundaries", () => {
  it("preserves a valid correlation ID and replaces an unsafe one", () => {
    const middleware = new CorrelationMiddleware();
    const next = vi.fn();
    const response = { setHeader: vi.fn() };
    const validRequest = { header: vi.fn().mockReturnValue("fixture-run-12") } as never;
    middleware.use(validRequest, response as never, next);
    expect(response.setHeader).toHaveBeenCalledWith("x-correlation-id", "fixture-run-12");

    const unsafeRequest = { header: vi.fn().mockReturnValue("unsafe header\nvalue") } as never;
    middleware.use(unsafeRequest, response as never, next);
    expect((unsafeRequest as { correlationId?: string }).correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("serializes database bigint fields without losing nested response structure", async () => {
    const interceptor = new JsonResponseInterceptor();
    const handler = { handle: () => of({ byteSize: 2048n, nested: [{ byteSize: 1024n }] }) };
    const result = await firstValueFrom(
      interceptor.intercept({} as ExecutionContext, handler as CallHandler),
    );
    expect(result).toEqual({ byteSize: 2048, nested: [{ byteSize: 1024 }] });
  });

  it("preserves binary file responses instead of serializing their internals", async () => {
    const interceptor = new JsonResponseInterceptor();
    const file = new StreamableFile(Buffer.from("binary drawing"));
    const handler = { handle: () => of(file) };
    const result = await firstValueFrom(
      interceptor.intercept({} as ExecutionContext, handler as CallHandler),
    );
    expect(result).toBe(file);
  });
});
