from __future__ import annotations

import asyncio

import httpx

from plandelta_agent.main import app


def request(path: str) -> httpx.Response:
    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(run())


def test_liveness() -> None:
    response = request("/health/live")

    assert response.status_code == 200
    assert response.json() == {"service": "agent", "status": "ok", "version": "0.2.0"}


def test_readiness_reports_runtime_without_loading_models() -> None:
    response = request("/health/ready")

    assert response.status_code == 200
    assert response.json()["localEmbeddingsConfigured"] is True
    assert response.json()["chatProvider"] in {"bedrock", "fake"}
    assert response.json()["liveChatReady"] is (
        response.json()["chatProvider"] == "bedrock"
    )
