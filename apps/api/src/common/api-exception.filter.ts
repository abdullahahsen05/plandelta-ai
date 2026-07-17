import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

type ExceptionBody = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: ExceptionBody = typeof raw === "object" && raw !== null ? raw : {};
    const defaultMessage =
      status >= 500 ? "The request could not be completed." : "The request is invalid.";
    const rawMessage = body.message;
    const message =
      typeof rawMessage === "string"
        ? rawMessage
        : Array.isArray(rawMessage)
          ? "One or more fields are invalid."
          : defaultMessage;
    const details =
      typeof body.details === "object" && body.details !== null
        ? body.details
        : Array.isArray(rawMessage)
          ? { issues: rawMessage }
          : {};

    if (status >= 500) {
      const errorName = exception instanceof Error ? exception.name : "UnknownError";
      this.logger.error(
        `Request failed with ${errorName}; correlationId=${request.correlationId ?? "missing"}`,
      );
    }

    response.status(status).json({
      error: {
        code:
          typeof body.code === "string"
            ? body.code
            : status >= 500
              ? "INTERNAL_ERROR"
              : "REQUEST_FAILED",
        message,
        details,
        correlationId: request.correlationId ?? "missing",
      },
    });
  }
}
