import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestPolicyMiddleware } from "../src/common/request-policy.middleware.js";

function createExchange(method = "GET", path = "/v1/projects") {
  const requestSetTimeout = vi.fn();
  const request = {
    method,
    path,
    ip: "127.0.0.1",
    correlationId: "test-correlation",
    setTimeout: requestSetTimeout,
  } as unknown as Request;
  const setHeader = vi.fn();
  const responseSetTimeout = vi.fn();
  const status = vi.fn();
  const json = vi.fn();
  const response = {
    headersSent: false,
    setHeader,
    setTimeout: responseSetTimeout,
    once: vi.fn(),
    status,
    json,
    end: vi.fn(),
  } as unknown as Response;
  status.mockReturnValue(response);
  return {
    request,
    response,
    next: vi.fn() as unknown as NextFunction,
    requestSetTimeout,
    responseSetTimeout,
    setHeader,
    status,
    json,
  };
}

describe("RequestPolicyMiddleware", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_READ_PER_MINUTE;
    delete process.env.RATE_LIMIT_WRITE_PER_MINUTE;
    delete process.env.REQUEST_TIMEOUT_MS;
  });

  it("sets security headers and request timeouts before continuing", () => {
    process.env.REQUEST_TIMEOUT_MS = "5000";
    const exchange = createExchange();

    new RequestPolicyMiddleware().use(exchange.request, exchange.response, exchange.next);

    expect(exchange.requestSetTimeout).toHaveBeenCalledWith(5000);
    expect(exchange.responseSetTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
    expect(exchange.setHeader).toHaveBeenCalledWith("x-content-type-options", "nosniff");
    expect(exchange.setHeader).toHaveBeenCalledWith("x-frame-options", "DENY");
    expect(exchange.next).toHaveBeenCalledOnce();
  });

  it("returns a safe 429 after the configured write allowance", () => {
    process.env.RATE_LIMIT_WRITE_PER_MINUTE = "1";
    const middleware = new RequestPolicyMiddleware();
    const first = createExchange("POST");
    const second = createExchange("POST");

    middleware.use(first.request, first.response, first.next);
    middleware.use(second.request, second.response, second.next);

    expect(first.next).toHaveBeenCalledOnce();
    expect(second.next).not.toHaveBeenCalled();
    expect(second.status).toHaveBeenCalledWith(429);
    expect(second.json).toHaveBeenCalledWith({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Wait before trying again.",
        details: {},
        correlationId: "test-correlation",
      },
    });
  });
});
