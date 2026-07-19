from __future__ import annotations

import hashlib
from uuid import UUID

from plandelta_agent.ingestion.chunking import StructureAwareChunker
from plandelta_agent.ingestion.errors import SafeIngestionError
from plandelta_agent.ingestion.extraction import DocumentExtractor
from plandelta_agent.ingestion.repository import (
    EmbeddedChunk,
    IngestionSource,
    KnowledgeRepository,
)
from plandelta_agent.ingestion.storage import StorageReader
from plandelta_agent.providers.embeddings import EmbeddingProvider


class IngestionProcessor:
    def __init__(
        self,
        *,
        repository: KnowledgeRepository,
        local_storage: StorageReader,
        s3_storage: StorageReader | None,
        extractor: DocumentExtractor,
        chunker: StructureAwareChunker,
        embeddings: EmbeddingProvider,
        embedding_version: str = "fastembed-0.8",
        embedding_batch_size: int = 16,
    ) -> None:
        if not 1 <= embedding_batch_size <= 32:
            raise ValueError("Embedding batch size is outside the supported range.")
        self._repository = repository
        self._local_storage = local_storage
        self._s3_storage = s3_storage
        self._extractor = extractor
        self._chunker = chunker
        self._embeddings = embeddings
        self._embedding_version = embedding_version
        self._embedding_batch_size = embedding_batch_size

    async def process(self, job_id: UUID) -> None:
        try:
            source = await self._repository.load_ingestion_source(job_id)
        except SafeIngestionError:
            raise
        except Exception:
            raise SafeIngestionError("KNOWLEDGE_DATABASE_UNAVAILABLE", retryable=True) from None
        try:
            reader = self._reader_for(source)
            document_bytes = await reader.read(source.storage_key)
            checksum = hashlib.sha256(document_bytes).hexdigest()
            if checksum != source.checksum_sha256:
                raise SafeIngestionError("KNOWLEDGE_CHECKSUM_MISMATCH", retryable=False)

            await self._repository.mark_stage(job_id, "extracting", 10)
            extracted = await self._extractor.extract(document_bytes, source.mime_type)
            await self._repository.mark_stage(job_id, "chunking", 45)
            drafts = self._chunker.chunk(extracted)
            if not drafts:
                raise SafeIngestionError("KNOWLEDGE_EXTRACTION_EMPTY", retryable=False)

            await self._repository.mark_stage(job_id, "embedding", 60)
            embedded: list[EmbeddedChunk] = []
            embedding_model: str | None = None
            for offset in range(0, len(drafts), self._embedding_batch_size):
                batch_drafts = drafts[offset : offset + self._embedding_batch_size]
                batch = await self._embeddings.embed([draft.content for draft in batch_drafts])
                embedding_model = batch.model
                embedded.extend(
                    EmbeddedChunk(draft=draft, embedding=vector.values)
                    for draft, vector in zip(batch_drafts, batch.vectors, strict=True)
                )
            if embedding_model is None:
                raise SafeIngestionError("KNOWLEDGE_EMBEDDING_FAILED", retryable=False)
            await self._repository.complete_ingestion(
                source,
                extracted,
                embedded,
                embedding_model=embedding_model,
                embedding_version=self._embedding_version,
                chunker_version=self._chunker.version,
            )
        except SafeIngestionError as error:
            await self._repository.fail_ingestion(source, error.code)
            raise
        except Exception as error:
            await self._repository.fail_ingestion(source, "KNOWLEDGE_INGESTION_FAILED")
            raise SafeIngestionError("KNOWLEDGE_INGESTION_FAILED", retryable=True) from error

    def _reader_for(self, source: IngestionSource) -> StorageReader:
        if source.storage_provider == "LOCAL":
            return self._local_storage
        if self._s3_storage is None:
            raise SafeIngestionError("KNOWLEDGE_STORAGE_UNAVAILABLE", retryable=True)
        return self._s3_storage
