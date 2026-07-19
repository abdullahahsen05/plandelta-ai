from __future__ import annotations

import asyncio
from collections.abc import Generator

import httpx
import pytest
from fastapi import Depends, FastAPI
from pydantic import ValidationError

from plandelta_agent.auth import require_internal_token
from plandelta_agent.config import _psycopg_database_url, load_settings

TEST_TOKEN = "agent-test-token-that-is-at-least-32-characters"


@pytest.fixture(autouse=True)
def configured_environment(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("AGENT_INTERNAL_TOKEN", TEST_TOKEN)
    monkeypatch.setenv("AGENT_CHAT_PROVIDER", "fake")
    monkeypatch.setenv("AGENT_TRACE_CONTENT_ENABLED", "false")
    load_settings.cache_clear()
    yield
    load_settings.cache_clear()


def request(headers: dict[str, str] | None = None) -> httpx.Response:
    app = FastAPI()

    @app.get("/protected", dependencies=[Depends(require_internal_token)])
    def protected() -> dict[str, bool]:
        return {"ok": True}

    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/protected", headers=headers)

    return asyncio.run(run())


def test_internal_auth_uses_constant_time_token_check() -> None:
    assert request().status_code == 401
    assert request({"X-PlanDelta-Internal-Token": "wrong"}).status_code == 401
    assert request({"X-PlanDelta-Internal-Token": TEST_TOKEN}).status_code == 200


def test_trace_content_cannot_be_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AGENT_TRACE_CONTENT_ENABLED", "true")
    load_settings.cache_clear()

    with pytest.raises(ValidationError, match="must remain false"):
        load_settings()


def test_bedrock_provider_requires_model_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AGENT_CHAT_PROVIDER", "bedrock")
    monkeypatch.delenv("BEDROCK_MODEL_ID", raising=False)
    load_settings.cache_clear()

    with pytest.raises(ValidationError, match="BEDROCK_MODEL_ID"):
        load_settings()


def test_database_url_removes_prisma_only_pool_options() -> None:
    normalized = _psycopg_database_url(
        "postgresql://user:password@pooler.example.test:6543/postgres"
        "?pgbouncer=true&sslmode=require&connection_limit=1"
    )

    assert normalized == (
        "postgresql://user:password@pooler.example.test:6543/postgres?sslmode=require"
    )
