from __future__ import annotations

import base64
from collections.abc import Mapping

import httpx
from pydantic import Field

from plandelta_agent.ingestion.errors import SafeIngestionError
from plandelta_agent.models.base import ContractModel


class OcrPagePayload(ContractModel):
    page_number: int = Field(gt=0)
    text: str = Field(max_length=250_000)
    confidence: float | None = Field(default=None, ge=0, le=1)


class OcrResponsePayload(ContractModel):
    provider: str = Field(min_length=1, max_length=80)
    provider_version: str = Field(min_length=1, max_length=40)
    pages: list[OcrPagePayload] = Field(min_length=1, max_length=20)


class VisionOcrFallback:
    def __init__(
        self,
        *,
        service_url: str,
        internal_secret: str,
        correlation_id: str,
        timeout_seconds: float = 45,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if len(internal_secret) < 32:
            raise ValueError("The vision internal secret is not configured.")
        self._service_url = service_url.rstrip("/")
        self._internal_secret = internal_secret
        self._correlation_id = correlation_id
        self._timeout_seconds = timeout_seconds
        self._transport = transport
        self._provider_version = "unknown"

    @property
    def provider_name(self) -> str:
        return "paddleocr"

    @property
    def provider_version(self) -> str:
        return self._provider_version

    async def extract_pages(
        self,
        document_bytes: bytes,
        page_numbers: list[int],
    ) -> Mapping[int, str]:
        try:
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=self._timeout_seconds,
            ) as client:
                response = await client.post(
                    f"{self._service_url}/internal/v1/ocr/pages",
                    headers={
                        "X-Internal-Service-Secret": self._internal_secret,
                        "X-Correlation-ID": self._correlation_id,
                    },
                    json={
                        "correlationId": self._correlation_id,
                        "documentBase64": base64.b64encode(document_bytes).decode(),
                        "pageNumbers": page_numbers,
                    },
                )
            if response.status_code != 200:
                raise SafeIngestionError("KNOWLEDGE_OCR_FAILED", retryable=True)
            payload = OcrResponsePayload.model_validate(response.json())
        except SafeIngestionError:
            raise
        except (httpx.HTTPError, ValueError) as error:
            raise SafeIngestionError("KNOWLEDGE_OCR_FAILED", retryable=True) from error
        self._provider_version = payload.provider_version
        return {page.page_number: page.text for page in payload.pages}
