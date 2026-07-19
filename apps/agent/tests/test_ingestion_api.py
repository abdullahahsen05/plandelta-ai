from __future__ import annotations

import asyncio
from collections.abc import Generator
from uuid import UUID

import httpx
import pytest

from plandelta_agent.config import load_settings
from plandelta_agent.ingestion import SafeIngestionError
from plandelta_agent.main import app
from plandelta_agent.runtime import get_runtime

TOKEN = "agent-test-token-that-is-at-least-32-characters"
JOB_ID = UUID("00000000-0000-4000-8000-000000000050")


class FakeRuntime:
    def __init__(self, failure: SafeIngestionError | None = None) -> None:
        self.calls: list[tuple[UUID, str]] = []
        self.failure = failure

    async def execute_ingestion(self, job_id: UUID, correlation_id: str) -> None:
        self.calls.append((job_id, correlation_id))
        if self.failure is not None:
            raise self.failure


@pytest.fixture(autouse=True)
def configured_environment(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("AGENT_INTERNAL_TOKEN", TOKEN)
    monkeypatch.setenv("AGENT_CHAT_PROVIDER", "fake")
    load_settings.cache_clear()
    yield
    app.dependency_overrides.clear()
    load_settings.cache_clear()


def post(
    runtime: FakeRuntime, *, token: str | None = TOKEN, body_id: UUID = JOB_ID
) -> httpx.Response:
    app.dependency_overrides[get_runtime] = lambda: runtime

    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"X-PlanDelta-Internal-Token": token} if token else {}
            return await client.post(
                f"/internal/v1/ingestion-jobs/{JOB_ID}/execute",
                headers=headers,
                json={"jobId": str(body_id), "correlationId": "ingestion-api-test"},
            )

    return asyncio.run(run())


def test_ingestion_endpoint_requires_internal_auth() -> None:
    response = post(FakeRuntime(), token=None)

    assert response.status_code == 401


def test_ingestion_endpoint_executes_only_the_matching_job() -> None:
    runtime = FakeRuntime()

    response = post(runtime)

    assert response.status_code == 200
    assert response.json() == {"jobId": str(JOB_ID), "status": "completed"}
    assert runtime.calls == [(JOB_ID, "ingestion-api-test")]


def test_ingestion_endpoint_rejects_mismatched_job_ids() -> None:
    runtime = FakeRuntime()

    response = post(
        runtime,
        body_id=UUID("00000000-0000-4000-8000-000000000051"),
    )

    assert response.status_code == 422
    assert runtime.calls == []


def test_ingestion_endpoint_returns_only_safe_failure_metadata() -> None:
    runtime = FakeRuntime(SafeIngestionError("KNOWLEDGE_EXTRACTION_FAILED", retryable=False))

    response = post(runtime)

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "KNOWLEDGE_EXTRACTION_FAILED",
            "message": "The supporting document could not be processed safely.",
            "retryable": False,
        }
    }
