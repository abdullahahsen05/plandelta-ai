from __future__ import annotations

import asyncio
from collections.abc import Mapping
from io import BytesIO

import pytest
from pypdf import PdfWriter

from plandelta_agent.ingestion import (
    DocumentExtractor,
    ExtractedDocument,
    ExtractedPage,
    SafeIngestionError,
    StructureAwareChunker,
)


class ScriptedOcr:
    provider_name = "test-ocr"
    provider_version = "1"

    def __init__(self, pages: Mapping[int, str]) -> None:
        self.pages = pages
        self.requested: list[int] = []

    async def extract_pages(
        self,
        _document_bytes: bytes,
        page_numbers: list[int],
    ) -> Mapping[int, str]:
        self.requested = page_numbers
        return self.pages


def blank_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_text_extraction_normalizes_content() -> None:
    extractor = DocumentExtractor(max_pages=10)

    result = asyncio.run(
        extractor.extract(
            b"\xef\xbb\xbfSECTION 01 10 00  \r\n\r\n  General requirements", "text/plain"
        )
    )

    assert result.parser_name == "utf8"
    assert result.pages[0].text == "SECTION 01 10 00\nGeneral requirements"
    assert result.character_count == len(result.pages[0].text)


def test_blank_pdf_uses_only_the_bounded_ocr_fallback() -> None:
    ocr = ScriptedOcr({1: "OCR recovered partition requirements."})
    extractor = DocumentExtractor(max_pages=10, ocr_fallback=ocr)

    result = asyncio.run(extractor.extract(blank_pdf(), "application/pdf"))

    assert ocr.requested == [1]
    assert result.pages[0].used_ocr is True
    assert result.pages[0].text == "OCR recovered partition requirements."
    assert result.ocr_provider == "test-ocr"


def test_blank_pdf_without_ocr_fails_safely() -> None:
    extractor = DocumentExtractor(max_pages=10)

    with pytest.raises(SafeIngestionError, match="KNOWLEDGE_OCR_REQUIRED"):
        asyncio.run(extractor.extract(blank_pdf(), "application/pdf"))


def test_structure_chunking_is_stable_and_page_scoped() -> None:
    document = ExtractedDocument(
        pages=[
            ExtractedPage(
                page_number=1,
                text=(
                    "SECTION 01 10 00 GENERAL REQUIREMENTS\n"
                    + "Coordinate partition layout with reflected ceiling plan. " * 20
                ),
            ),
            ExtractedPage(
                page_number=2,
                text=(
                    "SECTION 08 71 00 DOOR HARDWARE\n"
                    + "Provide hardware sets shown in the schedule. " * 18
                ),
            ),
        ],
        character_count=2000,
        parser_name="fixture",
        parser_version="1",
    )
    chunker = StructureAwareChunker(chunk_size=500, overlap=80)

    first = chunker.chunk(document)
    second = chunker.chunk(document)

    assert first == second
    assert len(first) >= 4
    assert [chunk.ordinal for chunk in first] == list(range(1, len(first) + 1))
    assert {chunk.page_number for chunk in first} == {1, 2}
    assert all(len(chunk.content) <= 500 for chunk in first)
    assert first[0].section_title == "SECTION 01 10 00 GENERAL REQUIREMENTS"
    assert first[-1].section_title == "SECTION 08 71 00 DOOR HARDWARE"
    assert first[0].conflict_key == "section-01-10-00-general-requirements"
