from __future__ import annotations

import hmac

from fastapi import Header

from plandelta_vision.config import load_settings
from plandelta_vision.errors import VisionError


def require_internal_secret(
    x_internal_service_secret: str | None = Header(default=None),
) -> None:
    expected = load_settings().internal_service_secret
    if not expected:
        raise VisionError(
            "INTERNAL_AUTH_UNAVAILABLE",
            "Internal service authentication is not configured.",
            503,
        )
    supplied = x_internal_service_secret or ""
    if not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise VisionError("INTERNAL_AUTH_REQUIRED", "Internal service authentication failed.", 401)
