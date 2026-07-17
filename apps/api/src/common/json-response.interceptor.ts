import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

function serializeJsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(serializeJsonValue);
  if (
    value instanceof Date ||
    value instanceof StreamableFile ||
    Buffer.isBuffer(value) ||
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, serializeJsonValue(entry)]),
  );
}

@Injectable()
export class JsonResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(serializeJsonValue));
  }
}
