from __future__ import annotations

import json
import logging
import re
import time
from collections.abc import Awaitable, Callable, Mapping
from typing import Final
from uuid import uuid4

from fastapi import Request, Response

LOGGER = logging.getLogger("plandelta.agent")
CORRELATION_PATTERN: Final = re.compile(r"^[A-Za-z0-9._:-]{1,100}$")
REDACTED_KEY_PARTS: Final = (
    "authorization",
    "content",
    "document",
    "message",
    "password",
    "prompt",
    "secret",
    "token",
)


def safe_correlation_id(value: str | None) -> str:
    if value and CORRELATION_PATTERN.fullmatch(value):
        return value
    return str(uuid4())


def redact_metadata(metadata: Mapping[str, object]) -> dict[str, object]:
    redacted: dict[str, object] = {}
    for key, value in metadata.items():
        normalized_key = key.casefold()
        if any(part in normalized_key for part in REDACTED_KEY_PARTS):
            redacted[key] = "[REDACTED]"
        elif isinstance(value, str | int | float | bool) or value is None:
            redacted[key] = value
        else:
            redacted[key] = "[OMITTED]"
    return redacted


def log_safe_event(event: str, correlation_id: str, metadata: Mapping[str, object]) -> None:
    payload = {
        "event": event,
        "correlationId": correlation_id,
        **redact_metadata(metadata),
    }
    LOGGER.info(json.dumps(payload, separators=(",", ":"), sort_keys=True))


async def request_telemetry_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    correlation_id = safe_correlation_id(request.headers.get("X-Correlation-ID"))
    started = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Correlation-ID"] = correlation_id
        return response
    finally:
        log_safe_event(
            "http_request_completed",
            correlation_id,
            {
                "method": request.method,
                "path": request.url.path,
                "statusCode": status_code,
                "durationMs": round((time.perf_counter() - started) * 1000, 2),
            },
        )
