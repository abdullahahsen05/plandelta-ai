from __future__ import annotations

import asyncio
import base64

import httpx
import pymupdf
import pytest

from plandelta_vision.config import load_settings
from plandelta_vision.main import app
from plandelta_vision.ocr import OcrEvidence

SECRET = "vision-test-secret-that-is-at-least-32-characters"


def pdf_bytes() -> bytes:
    document = pymupdf.open()
    document.new_page(width=200, height=200)
    try:
        return document.tobytes()
    finally:
        document.close()


def post(payload: dict[str, object], headers: dict[str, str] | None = None) -> httpx.Response:
    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post("/internal/v1/ocr/pages", json=payload, headers=headers)

    return asyncio.run(run())


@pytest.fixture(autouse=True)
def configured_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", SECRET)
    monkeypatch.setenv("OCR_ENABLED", "true")
    monkeypatch.setenv("KNOWLEDGE_MAX_PAGES", "100")
    load_settings.cache_clear()
    yield
    load_settings.cache_clear()


def request_payload() -> dict[str, object]:
    return {
        "correlationId": "ocr-document-test",
        "documentBase64": base64.b64encode(pdf_bytes()).decode(),
        "pageNumbers": [1],
    }


def test_document_ocr_requires_internal_auth() -> None:
    response = post(request_payload(), {"x-correlation-id": "ocr-document-test"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INTERNAL_AUTH_REQUIRED"


def test_document_ocr_returns_only_typed_page_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "plandelta_vision.main.extract_crop_text",
        lambda _image, _language: OcrEvidence(text="Recovered specification note.", confidence=0.9),
    )

    response = post(
        request_payload(),
        {
            "x-correlation-id": "ocr-document-test",
            "x-internal-service-secret": SECRET,
        },
    )

    assert response.status_code == 200
    assert response.json()["provider"] == "paddleocr"
    assert response.json()["pages"] == [
        {
            "pageNumber": 1,
            "text": "Recovered specification note.",
            "confidence": 0.9,
        }
    ]


def test_document_ocr_rejects_duplicate_pages() -> None:
    payload = {**request_payload(), "pageNumbers": [1, 1]}
    response = post(payload, {"x-internal-service-secret": SECRET})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REQUEST_VALIDATION_FAILED"
