from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from plandelta_agent.config import load_settings


def require_internal_token(
    supplied_token: Annotated[str | None, Header(alias="X-PlanDelta-Internal-Token")] = None,
) -> None:
    expected = load_settings().internal_token.get_secret_value()
    if supplied_token is None or not secrets.compare_digest(supplied_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INTERNAL_AUTH_REQUIRED", "message": "Internal authentication failed."},
        )
