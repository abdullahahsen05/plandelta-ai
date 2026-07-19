from __future__ import annotations

import hashlib
import re

from pydantic import Field

from plandelta_agent.ingestion.extraction import ExtractedDocument
from plandelta_agent.models.base import ContractModel

HEADING_PATTERN = re.compile(
    r"^(?:SECTION\s+)?(?:\d{1,3}(?:[.\s-]\d{1,3}){0,4}\s+)?[A-Z][A-Z0-9 /&(),.:_-]{4,120}$"
)


class KnowledgeChunkDraft(ContractModel):
    ordinal: int = Field(gt=0)
    content_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    page_number: int = Field(gt=0)
    section_path: str | None = Field(default=None, max_length=500)
    section_title: str | None = Field(default=None, max_length=240)
    character_start: int = Field(ge=0)
    character_end: int = Field(gt=0)
    excerpt: str = Field(min_length=1, max_length=1200)
    content: str = Field(min_length=1, max_length=8000)
    conflict_key: str | None = Field(default=None, max_length=240)


class StructureAwareChunker:
    version = "plandelta-structure-v1"

    def __init__(self, *, chunk_size: int, overlap: int) -> None:
        if not 400 <= chunk_size <= 4000:
            raise ValueError("Chunk size is outside the supported range.")
        if not 0 <= overlap < chunk_size:
            raise ValueError("Chunk overlap must be smaller than the chunk size.")
        self._chunk_size = chunk_size
        self._overlap = overlap

    def chunk(self, document: ExtractedDocument) -> list[KnowledgeChunkDraft]:
        chunks: list[KnowledgeChunkDraft] = []
        document_offset = 0
        for page in document.pages:
            section_title: str | None = None
            start = 0
            while start < len(page.text):
                end = min(len(page.text), start + self._chunk_size)
                if end < len(page.text):
                    boundary = page.text.rfind("\n", start + self._chunk_size // 2, end)
                    if boundary < 0:
                        boundary = page.text.rfind(" ", start + self._chunk_size // 2, end)
                    if boundary > start:
                        end = boundary
                content = page.text[start:end].strip()
                if content:
                    heading = self._nearest_heading(page.text, start)
                    if heading:
                        section_title = heading
                    ordinal = len(chunks) + 1
                    stable_material = (
                        f"{page.page_number}\0{section_title or ''}\0{content}".encode()
                    )
                    chunks.append(
                        KnowledgeChunkDraft(
                            ordinal=ordinal,
                            content_hash=hashlib.sha256(stable_material).hexdigest(),
                            page_number=page.page_number,
                            section_path=section_title,
                            section_title=section_title,
                            character_start=document_offset + start,
                            character_end=document_offset + end,
                            excerpt=content[:1200],
                            content=content,
                            conflict_key=self._conflict_key(section_title),
                        )
                    )
                if end >= len(page.text):
                    break
                next_start = max(start + 1, end - self._overlap)
                while next_start < len(page.text) and page.text[next_start].isspace():
                    next_start += 1
                start = next_start
            document_offset += len(page.text) + 1
        return chunks

    @staticmethod
    def _nearest_heading(text: str, position: int) -> str | None:
        lines = text[:position].splitlines()
        current_line = text[position:].splitlines()[0] if text[position:] else ""
        for line in reversed([*lines, current_line]):
            candidate = re.sub(r"\s+", " ", line).strip()
            if HEADING_PATTERN.fullmatch(candidate):
                return candidate[:240]
        return None

    @staticmethod
    def _conflict_key(section_title: str | None) -> str | None:
        if not section_title:
            return None
        normalized = re.sub(r"[^a-z0-9]+", "-", section_title.casefold()).strip("-")
        return normalized[:240] or None
