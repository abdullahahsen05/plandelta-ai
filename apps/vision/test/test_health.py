import asyncio

import httpx
import pytest

from plandelta_vision.main import app


def request(path: str) -> httpx.Response:
    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(run())


def test_liveness() -> None:
    response = request("/health/live")

    assert response.status_code == 200
    assert response.json() == {"service": "vision", "status": "ok", "version": "0.1.0"}


def test_engine_contract() -> None:
    response = request("/internal/v1/engine")

    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"
    assert "application/pdf" in response.json()["supported_formats"]

@pytest.mark.e2e
def test_readiness_boundary() -> None:
    response = request("/health/ready")

    assert response.status_code == 200
    assert response.json()["writable_temporary_directory"] is True
