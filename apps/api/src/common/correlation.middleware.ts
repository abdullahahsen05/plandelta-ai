import { randomUUID } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const validCorrelationId = /^[A-Za-z0-9._:-]{1,100}$/;

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const supplied = request.header("x-correlation-id");
    const correlationId = supplied && validCorrelationId.test(supplied) ? supplied : randomUUID();
    request.correlationId = correlationId;
    response.setHeader("x-correlation-id", correlationId);
    next();
  }
}
