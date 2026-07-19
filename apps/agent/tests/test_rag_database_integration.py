from __future__ import annotations

import asyncio
import hashlib
import os
import selectors
import sys
from pathlib import Path
from uuid import UUID, uuid4

import psycopg
import pytest

from plandelta_agent.ingestion import (
    DocumentExtractor,
    IngestionProcessor,
    LocalStorageReader,
    PostgresKnowledgeRepository,
    StructureAwareChunker,
)
from plandelta_agent.providers import LocalEmbeddingProvider
from plandelta_agent.retrieval import HybridKnowledgeRetriever

RUN_INTEGRATION = os.getenv("RUN_RAG_DATABASE_INTEGRATION") == "true"
integration_test = pytest.mark.skipif(
    not RUN_INTEGRATION,
    reason="Set RUN_RAG_DATABASE_INTEGRATION=true for the explicit Supabase RAG check.",
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_KEY = "samples/knowledge/coordination-specification.txt"


@integration_test
def test_real_ingestion_activation_and_hybrid_search() -> None:
    if sys.platform == "win32":
        asyncio.run(
            run_real_ingestion(),
            loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
        )
    else:
        asyncio.run(run_real_ingestion())


async def run_real_ingestion() -> None:
    try:
        await _run_real_ingestion()
    except psycopg.Error:
        pytest.fail("The RAG database integration encountered a database error.", pytrace=False)


async def _run_real_ingestion() -> None:
    database_url = os.getenv("DIRECT_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DIRECT_DATABASE_URL or DATABASE_URL is required.")
    fixture = (REPOSITORY_ROOT / FIXTURE_KEY).read_bytes()
    document_id = uuid4()
    version_id = uuid4()
    job_id = uuid4()
    async with await psycopg.AsyncConnection.connect(database_url) as connection:
        project_row = await (
            await connection.execute(
                """
                SELECT p.id, p.owner_id
                FROM projects p
                JOIN profiles owner ON owner.id = p.owner_id
                ORDER BY p.created_at
                LIMIT 1
                """
            )
        ).fetchone()
        if project_row is None:
            raise RuntimeError("The integration database has no owned project fixture.")
        project_id = UUID(str(project_row[0]))
        owner_id = UUID(str(project_row[1]))
        try:
            await seed_ingestion(
                connection,
                document_id=document_id,
                version_id=version_id,
                job_id=job_id,
                project_id=project_id,
                owner_id=owner_id,
                checksum=hashlib.sha256(fixture).hexdigest(),
            )
            await connection.commit()

            embeddings = LocalEmbeddingProvider(
                model_name="BAAI/bge-small-en-v1.5",
                dimension=384,
                timeout_seconds=120,
            )
            repository = PostgresKnowledgeRepository(database_url)
            processor = IngestionProcessor(
                repository=repository,
                local_storage=LocalStorageReader(
                    root=str(REPOSITORY_ROOT),
                    max_bytes=20 * 1024 * 1024,
                ),
                s3_storage=None,
                extractor=DocumentExtractor(max_pages=100),
                chunker=StructureAwareChunker(chunk_size=500, overlap=80),
                embeddings=embeddings,
            )
            await processor.process(job_id)

            retriever = HybridKnowledgeRetriever(
                repository=repository,
                embeddings=embeddings,
            )
            results = await retriever.search(
                project_id=project_id,
                query="What must be coordinated when partitions are relocated?",
                limit=6,
                document_types=["specification"],
            )
            assert results
            assert all(result.document_id == document_id for result in results)
            assert all(result.document_version_id == version_id for result in results)
            assert all(result.conflict_count >= 1 for result in results)

            status = await (
                await connection.execute(
                    """
                    SELECT d.status::text, v.status::text, v.is_active, j.status::text,
                           count(c.id)
                    FROM knowledge_documents d
                    JOIN knowledge_document_versions v ON v.id = d.active_version_id
                    JOIN ingestion_jobs j ON j.document_version_id = v.id
                    JOIN knowledge_chunks c ON c.document_version_id = v.id AND c.is_active
                    WHERE d.id = %s
                    GROUP BY d.status, v.status, v.is_active, j.status
                    """,
                    (document_id,),
                )
            ).fetchone()
            assert status is not None
            assert status[:4] == ("ready", "ready", True, "completed")
            assert int(status[4]) >= 2
        finally:
            await connection.execute(
                "DELETE FROM knowledge_documents WHERE id = %s",
                (document_id,),
            )
            await connection.commit()


async def seed_ingestion(
    connection: psycopg.AsyncConnection[tuple[object, ...]],
    *,
    document_id: UUID,
    version_id: UUID,
    job_id: UUID,
    project_id: UUID,
    owner_id: UUID,
    checksum: str,
) -> None:
    await connection.execute(
        """
        INSERT INTO knowledge_documents (
          id, project_id, owner_id, original_filename, detected_mime_type, byte_size,
          checksum_sha256, storage_provider, storage_key, document_type, status
        ) VALUES (%s, %s, %s, %s, 'text/plain', %s, %s, 'LOCAL', %s, 'specification', 'uploaded')
        """,
        (
            document_id,
            project_id,
            owner_id,
            "coordination-specification.txt",
            (REPOSITORY_ROOT / FIXTURE_KEY).stat().st_size,
            checksum,
            FIXTURE_KEY,
        ),
    )
    await connection.execute(
        """
        INSERT INTO knowledge_document_versions (
          id, document_id, project_id, revision_label, checksum_sha256, page_count,
          parser_name, parser_version, chunker_version, embedding_provider,
          embedding_model, embedding_dimension, status, is_active
        ) VALUES (
          %s, %s, %s, 'Integration fixture', %s, 1, 'utf8', '1',
          'plandelta-structure-v1', 'local', 'BAAI/bge-small-en-v1.5', 384, 'pending', false
        )
        """,
        (version_id, document_id, project_id, checksum),
    )
    await connection.execute(
        """
        INSERT INTO ingestion_jobs (
          id, document_id, document_version_id, project_id, status, idempotency_key
        ) VALUES (%s, %s, %s, %s, 'queued', %s)
        """,
        (job_id, document_id, version_id, project_id, uuid4()),
    )
