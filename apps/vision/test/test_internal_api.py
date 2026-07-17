from __future__ import annotations

import asyncio
import shutil
from pathlib import Path

import httpx
import pytest

from plandelta_vision.config import load_settings
from plandelta_vision.main import app

FIXTURES = Path(__file__).resolve().parents[2] / ".." / "samples" / "vision"


def post(payload: dict[str, object], headers: dict[str, str] | None = None) -> httpx.Response:
    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post("/internal/v1/analyses", json=payload, headers=headers)

    return asyncio.run(run())


@pytest.fixture
def configured_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    shutil.copy2(FIXTURES / "baseline.png", tmp_path / "baseline.png")
    shutil.copy2(FIXTURES / "added-wall.png", tmp_path / "candidate.png")
    monkeypatch.setenv("VISION_SHARED_ROOT", str(tmp_path))
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path / "tmp"))
    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "test-internal-secret-that-is-long-enough")
    monkeypatch.setenv("OCR_ENABLED", "false")
    load_settings.cache_clear()
    yield tmp_path
    load_settings.cache_clear()


def payload() -> dict[str, object]:
    return {
        "analysisId": "00000000-0000-4000-8000-000000000099",
        "correlationId": "api-contract-test",
        "baseline": {"kind": "local", "path": "baseline.png"},
        "candidate": {"kind": "local", "path": "candidate.png"},
        "selectedPage": 1,
        "configuration": {"ocrEnabled": False, "classifier": "rules"},
        "artifactOutput": {"kind": "local", "prefix": "analyses/test"},
    }


def test_analysis_endpoint_requires_internal_auth(configured_root: Path) -> None:
    response = post(payload(), {"x-correlation-id": "api-contract-test"})

    assert response.status_code == 401
    assert response.json()["error"] == {
        "code": "INTERNAL_AUTH_REQUIRED",
        "message": "Internal service authentication failed.",
        "correlationId": "api-contract-test",
    }


def test_analysis_endpoint_returns_typed_evidence(configured_root: Path) -> None:
    response = post(
        payload(),
        {
            "x-correlation-id": "api-contract-test",
            "x-internal-service-secret": "test-internal-secret-that-is-long-enough",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == "1.0"
    assert body["analysisId"] == payload()["analysisId"]
    assert body["metrics"]["regionCount"] >= 1
    assert body["changes"][0]["box"]["x"] >= 0


def test_unknown_request_fields_are_rejected(configured_root: Path) -> None:
    invalid = {**payload(), "unexpected": True}
    response = post(
        invalid,
        {
            "x-correlation-id": "validation-test",
            "x-internal-service-secret": "test-internal-secret-that-is-long-enough",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REQUEST_VALIDATION_FAILED"
