from __future__ import annotations

import asyncio
import hashlib
from datetime import date
from uuid import UUID

import pytest

from plandelta_agent.ingestion import (
    DocumentExtractor,
    EmbeddedChunk,
    ExtractedDocument,
    IngestionProcessor,
    IngestionSource,
    RetrievedKnowledge,
    SafeIngestionError,
    StructureAwareChunker,
)
from plandelta_agent.providers import LocalEmbeddingProvider
from plandelta_agent.retrieval import HybridKnowledgeRetriever

JOB_ID = UUID("00000000-0000-4000-8000-000000000040")
DOCUMENT_ID = UUID("00000000-0000-4000-8000-000000000041")
VERSION_ID = UUID("00000000-0000-4000-8000-000000000042")
PROJECT_ID = UUID("00000000-0000-4000-8000-000000000043")


class FakeEmbeddingModel:
    def embed(self, documents: list[str]) -> list[list[float]]:
        return [[(index + len(text)) / 1000 for index in range(384)] for text in documents]


class MemoryStorage:
    def __init__(self, content: bytes) -> None:
        self.content = content
        self.keys: list[str] = []

    async def read(self, key: str) -> bytes:
        self.keys.append(key)
        return self.content


class RecordingRepository:
    def __init__(self, source: IngestionSource) -> None:
        self.source = source
        self.stages: list[tuple[str, int]] = []
        self.completed: tuple[ExtractedDocument, list[EmbeddedChunk]] | None = None
        self.failure_code: str | None = None
        self.search_calls: list[dict[str, object]] = []

    async def load_ingestion_source(self, job_id: UUID) -> IngestionSource:
        assert job_id == self.source.job_id
        return self.source

    async def mark_stage(self, job_id: UUID, stage: str, progress: int) -> None:
        assert job_id == self.source.job_id
        self.stages.append((stage, progress))

    async def complete_ingestion(
        self,
        source: IngestionSource,
        extracted: ExtractedDocument,
        chunks: list[EmbeddedChunk],
        *,
        embedding_model: str,
        embedding_version: str,
        chunker_version: str,
    ) -> None:
        assert source == self.source
        assert embedding_model == "test-embedding"
        assert embedding_version == "fastembed-0.8"
        assert chunker_version == "plandelta-structure-v1"
        self.completed = (extracted, chunks)

    async def fail_ingestion(self, source: IngestionSource, code: str) -> None:
        assert source == self.source
        self.failure_code = code

    async def hybrid_search(
        self,
        *,
        project_id: UUID,
        query_text: str,
        query_embedding: list[float],
        limit: int,
        document_types: list[str] | None,
        effective_at: date | None,
        revision_labels: list[str] | None,
        page_numbers: list[int] | None,
        section_query: str | None,
        include_inactive_conflicts: bool,
        text_weight: float,
        vector_weight: float,
    ) -> list[RetrievedKnowledge]:
        self.search_calls.append(
            {
                "project_id": project_id,
                "query_text": query_text,
                "dimension": len(query_embedding),
                "limit": limit,
                "document_types": document_types,
                "effective_at": effective_at,
                "revision_labels": revision_labels,
                "page_numbers": page_numbers,
                "section_query": section_query,
                "include_inactive_conflicts": include_inactive_conflicts,
                "text_weight": text_weight,
                "vector_weight": vector_weight,
            }
        )
        return []


def embedding_provider() -> LocalEmbeddingProvider:
    return LocalEmbeddingProvider(
        model_name="test-embedding",
        dimension=384,
        model_factory=lambda _: FakeEmbeddingModel(),
    )


def source_for(content: bytes, checksum: str | None = None) -> IngestionSource:
    return IngestionSource(
        job_id=JOB_ID,
        document_id=DOCUMENT_ID,
        document_version_id=VERSION_ID,
        project_id=PROJECT_ID,
        storage_provider="LOCAL",
        storage_key="owner/project/knowledge/source.txt",
        mime_type="text/plain",
        checksum_sha256=checksum or hashlib.sha256(content).hexdigest(),
    )


def test_processor_extracts_embeds_and_completes_transactional_payload() -> None:
    content = (
        "SECTION 01 10 00 GENERAL REQUIREMENTS\n"
        + "Coordinate partition layout with reflected ceiling plan. " * 24
    ).encode()
    repository = RecordingRepository(source_for(content))
    processor = IngestionProcessor(
        repository=repository,
        local_storage=MemoryStorage(content),
        s3_storage=None,
        extractor=DocumentExtractor(max_pages=10),
        chunker=StructureAwareChunker(chunk_size=500, overlap=80),
        embeddings=embedding_provider(),
        embedding_batch_size=2,
    )

    asyncio.run(processor.process(JOB_ID))

    assert repository.stages == [
        ("extracting", 10),
        ("chunking", 45),
        ("embedding", 60),
    ]
    assert repository.failure_code is None
    assert repository.completed is not None
    extracted, chunks = repository.completed
    assert extracted.parser_name == "utf8"
    assert len(chunks) >= 2
    assert all(len(chunk.embedding) == 384 for chunk in chunks)
    assert [chunk.draft.ordinal for chunk in chunks] == list(range(1, len(chunks) + 1))


def test_processor_rejects_checksum_mismatch_before_extraction() -> None:
    content = b"valid stored content"
    repository = RecordingRepository(source_for(content, checksum="0" * 64))
    processor = IngestionProcessor(
        repository=repository,
        local_storage=MemoryStorage(content),
        s3_storage=None,
        extractor=DocumentExtractor(max_pages=10),
        chunker=StructureAwareChunker(chunk_size=500, overlap=80),
        embeddings=embedding_provider(),
    )

    with pytest.raises(SafeIngestionError, match="KNOWLEDGE_CHECKSUM_MISMATCH"):
        asyncio.run(processor.process(JOB_ID))

    assert repository.completed is None
    assert repository.failure_code == "KNOWLEDGE_CHECKSUM_MISMATCH"
    assert repository.stages == []


def test_hybrid_retriever_enforces_limits_and_preserves_server_scope() -> None:
    repository = RecordingRepository(source_for(b"source"))
    retriever = HybridKnowledgeRetriever(
        repository=repository,
        embeddings=embedding_provider(),
    )

    result = asyncio.run(
        retriever.search(
            project_id=PROJECT_ID,
            query="  partition   coordination ",
            limit=6,
            document_types=["specification"],
            effective_at=date(2026, 7, 19),
            revision_labels=["Issued for coordination"],
            page_numbers=[1],
            section_query="GENERAL REQUIREMENTS",
        )
    )

    assert result == []
    assert repository.search_calls == [
        {
            "project_id": PROJECT_ID,
            "query_text": "partition coordination",
            "dimension": 384,
            "limit": 6,
            "document_types": ["specification"],
            "effective_at": date(2026, 7, 19),
            "revision_labels": ["Issued for coordination"],
            "page_numbers": [1],
            "section_query": "GENERAL REQUIREMENTS",
            "include_inactive_conflicts": False,
            "text_weight": 0.45,
            "vector_weight": 0.55,
        }
    ]


def test_hybrid_retriever_rejects_unbounded_or_unknown_filters() -> None:
    repository = RecordingRepository(source_for(b"source"))
    retriever = HybridKnowledgeRetriever(
        repository=repository,
        embeddings=embedding_provider(),
    )

    with pytest.raises(ValueError, match="result count"):
        asyncio.run(retriever.search(project_id=PROJECT_ID, query="partition", limit=13))
    with pytest.raises(ValueError, match="filter"):
        asyncio.run(
            retriever.search(
                project_id=PROJECT_ID,
                query="partition",
                document_types=["private_unknown_type"],
            )
        )
    assert repository.search_calls == []
