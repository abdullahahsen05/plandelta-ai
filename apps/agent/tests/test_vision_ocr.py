from __future__ import annotations

import asyncio

import httpx
import pytest

from plandelta_agent.ingestion import SafeIngestionError, VisionOcrFallback

SECRET = "vision-test-secret-that-is-at-least-32-characters"


def test_vision_ocr_client_uses_internal_auth_and_typed_pages() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "provider": "paddleocr",
                "providerVersion": "3.0",
                "pages": [{"pageNumber": 2, "text": "Recovered page text.", "confidence": 0.91}],
            },
        )

    fallback = VisionOcrFallback(
        service_url="http://vision:8000",
        internal_secret=SECRET,
        correlation_id="ingestion-test",
        transport=httpx.MockTransport(handler),
    )

    result = asyncio.run(fallback.extract_pages(b"%PDF-1.7 fixture", [2]))

    assert result == {2: "Recovered page text."}
    assert fallback.provider_name == "paddleocr"
    assert fallback.provider_version == "3.0"
    assert len(requests) == 1
    assert requests[0].headers["x-internal-service-secret"] == SECRET
    assert requests[0].url.path == "/internal/v1/ocr/pages"


def test_vision_ocr_client_maps_provider_failures_to_safe_code() -> None:
    fallback = VisionOcrFallback(
        service_url="http://vision:8000",
        internal_secret=SECRET,
        correlation_id="ingestion-test",
        transport=httpx.MockTransport(lambda _: httpx.Response(503, json={"private": "detail"})),
    )

    with pytest.raises(SafeIngestionError, match="KNOWLEDGE_OCR_FAILED"):
        asyncio.run(fallback.extract_pages(b"%PDF-1.7 fixture", [1]))
