from __future__ import annotations

from functools import lru_cache
from typing import Protocol
from uuid import UUID

from plandelta_agent.agents import build_specialists
from plandelta_agent.config import AgentSettings, load_settings
from plandelta_agent.graph import AgentWorkflow
from plandelta_agent.ingestion import (
    DocumentExtractor,
    IngestionProcessor,
    LocalStorageReader,
    PostgresKnowledgeRepository,
    S3StorageReader,
    StructureAwareChunker,
    VisionOcrFallback,
)
from plandelta_agent.models.state import RunContext
from plandelta_agent.providers import (
    BedrockChatProvider,
    DeterministicChatProvider,
    LocalEmbeddingProvider,
)
from plandelta_agent.retrieval import HybridKnowledgeRetriever
from plandelta_agent.tools import PostgresEvidenceTools, build_tool_registry


class AgentRuntimeUnavailableError(RuntimeError):
    pass


class IngestionRuntime(Protocol):
    async def execute_ingestion(self, job_id: UUID, correlation_id: str) -> None: ...


class AgentRuntime:
    def __init__(self, settings: AgentSettings) -> None:
        self._settings = settings
        self._embeddings = LocalEmbeddingProvider(
            model_name=settings.embedding_model,
            dimension=settings.embedding_dimension,
            timeout_seconds=min(settings.run_timeout_seconds, 45),
        )

    @property
    def embeddings_loaded(self) -> bool:
        return self._embeddings.is_loaded

    async def execute_ingestion(self, job_id: UUID, correlation_id: str) -> None:
        settings = self._settings
        if settings.database_url is None:
            raise AgentRuntimeUnavailableError("DATABASE_URL is not configured.")
        ocr = (
            VisionOcrFallback(
                service_url=settings.vision_service_url,
                internal_secret=settings.vision_internal_secret.get_secret_value(),
                correlation_id=correlation_id,
                timeout_seconds=min(settings.run_timeout_seconds, 60),
            )
            if settings.vision_internal_secret is not None
            else None
        )
        s3_storage = (
            S3StorageReader(
                bucket=settings.s3_bucket,
                prefix=settings.s3_prefix,
                region=settings.s3_region,
                max_bytes=settings.knowledge_max_file_bytes,
            )
            if settings.s3_bucket
            else None
        )
        processor = IngestionProcessor(
            repository=PostgresKnowledgeRepository(
                settings.database_url.get_secret_value(),
            ),
            local_storage=LocalStorageReader(
                root=settings.local_storage_root,
                max_bytes=settings.knowledge_max_file_bytes,
            ),
            s3_storage=s3_storage,
            extractor=DocumentExtractor(
                max_pages=settings.knowledge_max_pages,
                ocr_fallback=ocr,
            ),
            chunker=StructureAwareChunker(
                chunk_size=settings.knowledge_chunk_size,
                overlap=settings.knowledge_chunk_overlap,
            ),
            embeddings=self._embeddings,
        )
        await processor.process(job_id)

    def create_workflow(self, context: RunContext) -> AgentWorkflow:
        settings = self._settings
        if settings.database_url is None:
            raise AgentRuntimeUnavailableError("DATABASE_URL is not configured.")
        repository = PostgresKnowledgeRepository(settings.database_url.get_secret_value())
        retriever = HybridKnowledgeRetriever(
            repository=repository,
            embeddings=self._embeddings,
            max_results=settings.max_retrieved_chunks,
        )
        registry = build_tool_registry(
            PostgresEvidenceTools(settings.database_url.get_secret_value(), retriever)
        )
        provider = (
            BedrockChatProvider(
                model_id=settings.bedrock_model_id or "",
                region=settings.bedrock_region,
                timeout_seconds=min(settings.run_timeout_seconds, 45),
            )
            if settings.chat_provider == "bedrock"
            else DeterministicChatProvider()
        )
        return AgentWorkflow(
            context=context,
            provider=provider,
            specialists=build_specialists(registry),
        )


@lru_cache(maxsize=1)
def get_runtime() -> AgentRuntime:
    return AgentRuntime(load_settings())
