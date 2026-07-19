from __future__ import annotations

import asyncio
import re
from collections.abc import Mapping
from io import BytesIO
from typing import Protocol

from pydantic import Field
from pypdf import PdfReader

from plandelta_agent.ingestion.errors import SafeIngestionError
from plandelta_agent.models.base import ContractModel


class ExtractedPage(ContractModel):
    page_number: int = Field(gt=0)
    text: str = Field(max_length=250_000)
    used_ocr: bool = False


class ExtractedDocument(ContractModel):
    pages: list[ExtractedPage] = Field(min_length=1, max_length=200)
    character_count: int = Field(ge=0, le=2_000_000)
    parser_name: str = Field(min_length=1, max_length=80)
    parser_version: str = Field(min_length=1, max_length=40)
    ocr_provider: str | None = Field(default=None, max_length=80)
    ocr_version: str | None = Field(default=None, max_length=40)


class OcrFallback(Protocol):
    @property
    def provider_name(self) -> str: ...

    @property
    def provider_version(self) -> str: ...

    async def extract_pages(
        self,
        document_bytes: bytes,
        page_numbers: list[int],
    ) -> Mapping[int, str]: ...


class DocumentExtractor:
    def __init__(
        self,
        *,
        max_pages: int,
        max_characters: int = 2_000_000,
        ocr_fallback: OcrFallback | None = None,
        max_ocr_pages: int = 20,
    ) -> None:
        self._max_pages = max_pages
        self._max_characters = max_characters
        self._ocr_fallback = ocr_fallback
        self._max_ocr_pages = max_ocr_pages

    async def extract(self, document_bytes: bytes, mime_type: str) -> ExtractedDocument:
        if mime_type == "text/plain":
            return self._extract_text(document_bytes)
        if mime_type != "application/pdf":
            raise SafeIngestionError("KNOWLEDGE_DOCUMENT_UNSUPPORTED", retryable=False)
        pages = await asyncio.to_thread(self._extract_pdf_pages, document_bytes)
        missing = [page.page_number for page in pages if len(page.text.strip()) < 32]
        ocr_provider: str | None = None
        ocr_version: str | None = None
        if missing:
            if self._ocr_fallback is None or len(missing) > self._max_ocr_pages:
                raise SafeIngestionError("KNOWLEDGE_OCR_REQUIRED", retryable=False)
            try:
                ocr_text = await self._ocr_fallback.extract_pages(document_bytes, missing)
            except SafeIngestionError:
                raise
            except Exception as error:
                raise SafeIngestionError("KNOWLEDGE_OCR_FAILED", retryable=True) from error
            pages = [
                ExtractedPage(
                    page_number=page.page_number,
                    text=self._normalize_text(ocr_text.get(page.page_number, ""))
                    if page.page_number in missing
                    else page.text,
                    used_ocr=page.page_number in missing,
                )
                for page in pages
            ]
            if any(not page.text.strip() for page in pages):
                raise SafeIngestionError("KNOWLEDGE_EXTRACTION_EMPTY", retryable=False)
            ocr_provider = self._ocr_fallback.provider_name
            ocr_version = self._ocr_fallback.provider_version
        return self._result(
            pages,
            parser_name="pypdf",
            parser_version="6",
            ocr_provider=ocr_provider,
            ocr_version=ocr_version,
        )

    def _extract_text(self, document_bytes: bytes) -> ExtractedDocument:
        try:
            text = document_bytes.decode("utf-8")
        except UnicodeDecodeError as error:
            raise SafeIngestionError("KNOWLEDGE_EXTRACTION_FAILED", retryable=False) from error
        normalized = self._normalize_text(text.lstrip("\ufeff"))
        if not normalized:
            raise SafeIngestionError("KNOWLEDGE_EXTRACTION_EMPTY", retryable=False)
        return self._result(
            [ExtractedPage(page_number=1, text=normalized)],
            parser_name="utf8",
            parser_version="1",
        )

    def _extract_pdf_pages(self, document_bytes: bytes) -> list[ExtractedPage]:
        try:
            reader = PdfReader(BytesIO(document_bytes), strict=True)
            if reader.is_encrypted:
                raise SafeIngestionError("KNOWLEDGE_DOCUMENT_ENCRYPTED", retryable=False)
            if not 1 <= len(reader.pages) <= self._max_pages:
                raise SafeIngestionError("KNOWLEDGE_DOCUMENT_PAGE_LIMIT", retryable=False)
            return [
                ExtractedPage(
                    page_number=index,
                    text=self._normalize_text(page.extract_text() or ""),
                )
                for index, page in enumerate(reader.pages, start=1)
            ]
        except SafeIngestionError:
            raise
        except Exception as error:
            raise SafeIngestionError("KNOWLEDGE_EXTRACTION_FAILED", retryable=False) from error

    def _result(
        self,
        pages: list[ExtractedPage],
        *,
        parser_name: str,
        parser_version: str,
        ocr_provider: str | None = None,
        ocr_version: str | None = None,
    ) -> ExtractedDocument:
        character_count = sum(len(page.text) for page in pages)
        if character_count <= 0:
            raise SafeIngestionError("KNOWLEDGE_EXTRACTION_EMPTY", retryable=False)
        if character_count > self._max_characters:
            raise SafeIngestionError("KNOWLEDGE_EXTRACTION_LIMIT", retryable=False)
        return ExtractedDocument(
            pages=pages,
            character_count=character_count,
            parser_name=parser_name,
            parser_version=parser_version,
            ocr_provider=ocr_provider,
            ocr_version=ocr_version,
        )

    @staticmethod
    def _normalize_text(value: str) -> str:
        lines = [
            re.sub(r"[^\S\n]+", " ", line).strip()
            for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        ]
        return "\n".join(line for line in lines if line).strip()
