from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from typing import Literal, Protocol, cast
from uuid import UUID

import psycopg
from psycopg.rows import tuple_row
from pydantic import Field

from plandelta_agent.ingestion.chunking import KnowledgeChunkDraft
from plandelta_agent.ingestion.errors import SafeIngestionError
from plandelta_agent.ingestion.extraction import ExtractedDocument
from plandelta_agent.models.base import ContractModel


class IngestionSource(ContractModel):
    job_id: UUID
    document_id: UUID
    document_version_id: UUID
    project_id: UUID
    storage_provider: Literal["LOCAL", "S3"]
    storage_key: str = Field(min_length=1, max_length=1024)
    mime_type: Literal["application/pdf", "text/plain"]
    checksum_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class EmbeddedChunk(ContractModel):
    draft: KnowledgeChunkDraft
    embedding: list[float] = Field(min_length=384, max_length=384)


class RetrievedKnowledge(ContractModel):
    chunk_id: UUID
    document_id: UUID
    document_version_id: UUID
    filename: str = Field(min_length=1, max_length=255)
    document_type: str = Field(min_length=1, max_length=80)
    page_number: int = Field(gt=0)
    section_title: str | None = Field(default=None, max_length=240)
    excerpt: str = Field(min_length=1, max_length=1200)
    revision_label: str | None = Field(default=None, max_length=120)
    effective_date: date | None = None
    checksum_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    is_active: bool
    is_conflicting: bool
    text_score: float = Field(ge=0, le=1)
    vector_score: float = Field(ge=0, le=1)
    combined_score: float = Field(ge=0, le=1)
    conflict_count: int = Field(ge=1)


class KnowledgeRepository(Protocol):
    async def load_ingestion_source(self, job_id: UUID) -> IngestionSource: ...

    async def mark_stage(self, job_id: UUID, stage: str, progress: int) -> None: ...

    async def complete_ingestion(
        self,
        source: IngestionSource,
        extracted: ExtractedDocument,
        chunks: list[EmbeddedChunk],
        *,
        embedding_model: str,
        embedding_version: str,
        chunker_version: str,
    ) -> None: ...

    async def fail_ingestion(self, source: IngestionSource, code: str) -> None: ...

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
    ) -> list[RetrievedKnowledge]: ...


class PostgresKnowledgeRepository:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise ValueError("A database URL is required.")
        self._database_url = database_url

    async def load_ingestion_source(self, job_id: UUID) -> IngestionSource:
        async with (
            await psycopg.AsyncConnection.connect(
                self._database_url,
                row_factory=tuple_row,
            ) as connection,
            connection.cursor() as cursor,
        ):
            await cursor.execute(
                """
                    SELECT j.id, d.id, v.id, d.project_id, v.storage_provider::text,
                           v.storage_key, v.detected_mime_type, v.checksum_sha256
                    FROM ingestion_jobs j
                    JOIN knowledge_documents d ON d.id = j.document_id
                    JOIN knowledge_document_versions v ON v.id = j.document_version_id
                    WHERE j.id = %s
                      AND j.status IN ('queued', 'claimed', 'retrying')
                      AND d.deleted_at IS NULL
                    """,
                (job_id,),
            )
            row = await cursor.fetchone()
        if row is None:
            raise SafeIngestionError("KNOWLEDGE_JOB_NOT_FOUND", retryable=False)
        return IngestionSource(
            job_id=cast(UUID, row[0]),
            document_id=cast(UUID, row[1]),
            document_version_id=cast(UUID, row[2]),
            project_id=cast(UUID, row[3]),
            storage_provider=cast(Literal["LOCAL", "S3"], row[4].upper()),
            storage_key=cast(str, row[5]),
            mime_type=cast(Literal["application/pdf", "text/plain"], row[6]),
            checksum_sha256=cast(str, row[7]),
        )

    async def mark_stage(self, job_id: UUID, stage: str, progress: int) -> None:
        status_by_stage = {
            "extracting": "extracting",
            "chunking": "chunking",
            "embedding": "embedding",
        }
        status = status_by_stage.get(stage)
        if status is None or not 0 <= progress <= 99:
            raise ValueError("Invalid ingestion stage update.")
        async with await psycopg.AsyncConnection.connect(  # noqa: SIM117
            self._database_url
        ) as connection:
            async with connection.transaction():
                await connection.execute(
                    """
                    UPDATE ingestion_jobs
                    SET status = %s, current_stage = %s, progress = %s,
                        heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND status NOT IN ('completed', 'failed', 'cancelled')
                    """,
                    (status, stage, progress, job_id),
                )
                await connection.execute(
                    """
                    UPDATE knowledge_documents d
                    SET status = CASE
                          WHEN d.active_version_id IS NULL THEN %s::"KnowledgeDocumentStatus"
                          ELSE 'ready'::"KnowledgeDocumentStatus"
                        END,
                        failure_code = NULL
                    FROM ingestion_jobs j
                    WHERE j.id = %s AND d.id = j.document_id
                    """,
                    ("embedding" if stage == "embedding" else "extracting", job_id),
                )
                await connection.execute(
                    """
                    UPDATE knowledge_document_versions v
                    SET status = %s, failure_code = NULL
                    FROM ingestion_jobs j
                    WHERE j.id = %s AND v.id = j.document_version_id
                    """,
                    ("embedding" if stage == "embedding" else "extracting", job_id),
                )

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
        if not chunks:
            raise SafeIngestionError("KNOWLEDGE_EXTRACTION_EMPTY", retryable=False)
        async with await psycopg.AsyncConnection.connect(  # noqa: SIM117
            self._database_url
        ) as connection:
            async with connection.transaction():
                await connection.execute(
                    """
                    UPDATE knowledge_chunks
                    SET is_active = false
                    WHERE document_id = %s
                    """,
                    (source.document_id,),
                )
                await connection.execute(
                    """
                    UPDATE knowledge_document_versions
                    SET is_active = false
                    WHERE document_id = %s AND id <> %s
                    """,
                    (source.document_id, source.document_version_id),
                )
                await connection.execute(
                    "DELETE FROM knowledge_chunks WHERE document_version_id = %s",
                    (source.document_version_id,),
                )
                for chunk in chunks:
                    vector_literal = self._vector_literal(chunk.embedding)
                    await connection.execute(
                        """
                        INSERT INTO knowledge_chunks (
                          document_version_id, document_id, project_id, ordinal, content_hash,
                          page_number, section_path, section_title, character_start, character_end,
                          excerpt, content, embedding, embedding_provider, embedding_model,
                          embedding_version, chunker_version, is_active, conflict_key
                        ) VALUES (
                          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                          %s, %s, %s::extensions.vector, 'local', %s, %s, %s, true, %s
                        )
                        """,
                        (
                            source.document_version_id,
                            source.document_id,
                            source.project_id,
                            chunk.draft.ordinal,
                            chunk.draft.content_hash,
                            chunk.draft.page_number,
                            chunk.draft.section_path,
                            chunk.draft.section_title,
                            chunk.draft.character_start,
                            chunk.draft.character_end,
                            chunk.draft.excerpt,
                            chunk.draft.content,
                            vector_literal,
                            embedding_model,
                            embedding_version,
                            chunker_version,
                            chunk.draft.conflict_key,
                        ),
                    )
                await connection.execute(
                    """
                    UPDATE knowledge_document_versions
                    SET status = 'ready', is_active = true, failure_code = NULL,
                        extracted_character_count = %s, parser_name = %s, parser_version = %s,
                        ocr_provider = %s, ocr_version = %s, completed_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        extracted.character_count,
                        extracted.parser_name,
                        extracted.parser_version,
                        extracted.ocr_provider,
                        extracted.ocr_version,
                        source.document_version_id,
                    ),
                )
                await connection.execute(
                    """
                    UPDATE knowledge_documents
                    SET status = 'ready', active_version_id = %s, failure_code = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (source.document_version_id, source.document_id),
                )
                await connection.execute(
                    """
                    UPDATE ingestion_jobs
                    SET status = 'completed', progress = 100, current_stage = 'completed',
                        lease_owner = NULL, lease_expires_at = NULL, failure_code = NULL,
                        completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (source.job_id,),
                )

    async def fail_ingestion(self, source: IngestionSource, code: str) -> None:
        safe_code = code[:100]
        async with await psycopg.AsyncConnection.connect(  # noqa: SIM117
            self._database_url
        ) as connection:
            async with connection.transaction():
                await connection.execute(
                    """
                    UPDATE ingestion_jobs
                    SET status = 'failed', current_stage = 'failed', failure_code = %s,
                        lease_owner = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (safe_code, source.job_id),
                )
                await connection.execute(
                    """
                    UPDATE knowledge_document_versions
                    SET status = 'failed', is_active = false, failure_code = %s
                    WHERE id = %s
                    """,
                    (safe_code, source.document_version_id),
                )
                await connection.execute(
                    """
                    UPDATE knowledge_documents
                    SET status = CASE
                          WHEN active_version_id IS NULL THEN 'failed'::"KnowledgeDocumentStatus"
                          ELSE 'ready'::"KnowledgeDocumentStatus"
                        END,
                        failure_code = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (safe_code, source.document_id),
                )

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
        vector_literal = self._vector_literal(query_embedding)
        async with (
            await psycopg.AsyncConnection.connect(
                self._database_url,
                row_factory=tuple_row,
            ) as connection,
            connection.cursor() as cursor,
        ):
            await cursor.execute(
                """
                    SELECT * FROM hybrid_search_knowledge_v2(
                      %s::uuid, %s::text, %s::extensions.vector, %s::integer,
                      %s::text[], %s::date, %s::text[], %s::integer[], %s::text,
                      %s::boolean, %s::real, %s::real
                    )
                    """,
                (
                    project_id,
                    query_text,
                    vector_literal,
                    limit,
                    document_types,
                    effective_at,
                    revision_labels,
                    page_numbers,
                    section_query,
                    include_inactive_conflicts,
                    text_weight,
                    vector_weight,
                ),
            )
            rows = await cursor.fetchall()
        return [self._retrieved(row) for row in rows]

    @staticmethod
    def _retrieved(row: Sequence[object]) -> RetrievedKnowledge:
        return RetrievedKnowledge(
            chunk_id=cast(UUID, row[0]),
            document_id=cast(UUID, row[1]),
            document_version_id=cast(UUID, row[2]),
            filename=cast(str, row[3]),
            document_type=cast(str, row[4]),
            page_number=cast(int, row[5]),
            section_title=cast(str | None, row[6]),
            excerpt=cast(str, row[7]),
            revision_label=cast(str | None, row[8]),
            effective_date=cast(date | None, row[9]),
            checksum_sha256=cast(str, row[10]),
            is_active=cast(bool, row[11]),
            is_conflicting=cast(bool, row[12]),
            text_score=float(cast(float, row[13])),
            vector_score=float(cast(float, row[14])),
            combined_score=float(cast(float, row[15])),
            conflict_count=cast(int, row[16]),
        )

    @staticmethod
    def _vector_literal(values: list[float]) -> str:
        if len(values) != 384:
            raise ValueError("The database requires 384-dimensional embeddings.")
        return "[" + ",".join(f"{value:.9g}" for value in values) + "]"
