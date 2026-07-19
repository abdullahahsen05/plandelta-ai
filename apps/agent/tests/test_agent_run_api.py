from __future__ import annotations

import asyncio
from collections.abc import Generator
from uuid import UUID

import httpx
import pytest

from plandelta_agent.config import load_settings
from plandelta_agent.graph import GraphExecutionResult
from plandelta_agent.main import app
from plandelta_agent.models.answers import AgentConfidence, VerifiedAnswer, VerifierResult
from plandelta_agent.runtime import get_runtime

TOKEN = "agent-test-token-that-is-at-least-32-characters"
RUN_ID = UUID("00000000-0000-4000-8000-000000000060")


class FakeRuntime:
    def __init__(self) -> None:
        self.calls: list[tuple[UUID, str]] = []

    async def execute_agent_run(
        self,
        run_id: UUID,
        correlation_id: str,
    ) -> GraphExecutionResult:
        self.calls.append((run_id, correlation_id))
        return GraphExecutionResult(
            answer=VerifiedAnswer(
                status="insufficient_evidence",
                answer_markdown="No verified project evidence supports an answer yet.",
                confidence=AgentConfidence.INSUFFICIENT,
                warnings=["Add a completed comparison or supporting document."],
                citations=[],
                provider="deterministic",
                prompt_version="agent-v1",
            ),
            verifier=VerifierResult(
                approved=True,
                reason_codes=[],
                invalid_claim_ids=[],
                invalid_citation_ids=[],
                repairable=False,
            ),
            selected_specialists=[],
            trace=[],
            model_turns=0,
            tool_calls=0,
            retrieved_chunks=0,
            input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            estimated_cost_usd=0,
            repair_passes=0,
        )


@pytest.fixture(autouse=True)
def configured_environment(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("AGENT_INTERNAL_TOKEN", TOKEN)
    monkeypatch.setenv("AGENT_CHAT_PROVIDER", "fake")
    load_settings.cache_clear()
    yield
    app.dependency_overrides.clear()
    load_settings.cache_clear()


def post(
    runtime: FakeRuntime,
    *,
    token: str | None = TOKEN,
    body_id: UUID = RUN_ID,
) -> httpx.Response:
    app.dependency_overrides[get_runtime] = lambda: runtime

    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"X-PlanDelta-Internal-Token": token} if token else {}
            return await client.post(
                f"/internal/v1/agent-runs/{RUN_ID}/execute",
                headers=headers,
                json={"runId": str(body_id), "correlationId": "agent-api-test"},
            )

    return asyncio.run(run())


def test_agent_run_endpoint_requires_internal_auth() -> None:
    assert post(FakeRuntime(), token=None).status_code == 401


@pytest.mark.e2e
def test_agent_run_endpoint_executes_only_matching_claimed_run() -> None:
    runtime = FakeRuntime()
    response = post(runtime)

    assert response.status_code == 200
    assert response.json()["result"]["answer"]["status"] == "insufficient_evidence"
    assert runtime.calls == [(RUN_ID, "agent-api-test")]


def test_agent_run_endpoint_rejects_mismatched_run_ids() -> None:
    runtime = FakeRuntime()
    response = post(
        runtime,
        body_id=UUID("00000000-0000-4000-8000-000000000061"),
    )

    assert response.status_code == 422
    assert runtime.calls == []
