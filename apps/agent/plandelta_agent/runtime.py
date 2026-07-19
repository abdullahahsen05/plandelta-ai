from __future__ import annotations

from functools import lru_cache
from typing import Protocol
from uuid import UUID

import psycopg

from plandelta_agent.agents import build_specialists
from plandelta_agent.config import AgentSettings, load_settings
from plandelta_agent.graph import AgentWorkflow, GraphExecutionResult, PostgresGraphResultSink
from plandelta_agent.ingestion import (
    DocumentExtractor,
    IngestionProcessor,
    LocalStorageReader,
    PostgresKnowledgeRepository,
    S3StorageReader,
    StructureAwareChunker,
    VisionOcrFallback,
)
from plandelta_agent.models.evidence import AnalysisProfileId
from plandelta_agent.models.state import RunContext, RunLimits
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

    async def execute_agent_run(
        self, run_id: UUID, correlation_id: str
    ) -> GraphExecutionResult: ...


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

    async def execute_agent_run(
        self,
        run_id: UUID,
        correlation_id: str,
    ) -> GraphExecutionResult:
        context, question = await self._load_run(run_id, correlation_id)
        return await self.create_workflow(context).execute(question)

    async def _load_run(
        self,
        run_id: UUID,
        correlation_id: str,
    ) -> tuple[RunContext, str]:
        settings = self._settings
        if settings.database_url is None:
            raise AgentRuntimeUnavailableError("DATABASE_URL is not configured.")
        async with await psycopg.AsyncConnection.connect(
            settings.database_url.get_secret_value()
        ) as connection:
            cursor = await connection.execute(
                """
                SELECT p.owner_id, r.project_id, r.conversation_id, r.user_message_id,
                       r.analysis_id, r.analysis_profile::text, r.correlation_id,
                       r.status::text, r.cancellation_requested, m.content
                FROM agent_runs r
                JOIN projects p ON p.id = r.project_id
                JOIN messages m ON m.id = r.user_message_id
                WHERE r.id = %s
                """,
                (run_id,),
            )
            row = await cursor.fetchone()
        if row is None:
            raise AgentRuntimeUnavailableError("AGENT_RUN_NOT_FOUND")
        (
            owner_id,
            project_id,
            conversation_id,
            message_id,
            analysis_id,
            profile_id,
            persisted_correlation_id,
            run_status,
            cancellation_requested,
            question,
        ) = row
        if persisted_correlation_id != correlation_id:
            raise AgentRuntimeUnavailableError("AGENT_CORRELATION_MISMATCH")
        if run_status not in {"running", "verifying"}:
            raise AgentRuntimeUnavailableError("AGENT_RUN_NOT_CLAIMED")
        if cancellation_requested:
            raise AgentRuntimeUnavailableError("AGENT_CANCELLED")
        return (
            RunContext(
                owner_id=owner_id,
                project_id=project_id,
                conversation_id=conversation_id,
                message_id=message_id,
                run_id=run_id,
                analysis_id=analysis_id,
                correlation_id=correlation_id,
                profile_id=AnalysisProfileId(profile_id),
                limits=RunLimits(
                    max_model_turns=settings.max_model_turns,
                    max_tool_calls=settings.max_tool_calls,
                    max_specialists=3,
                    max_retrieved_chunks=settings.max_retrieved_chunks,
                    max_total_tokens=12_000,
                    max_repair_passes=settings.max_repair_passes,
                    timeout_seconds=settings.run_timeout_seconds,
                    max_estimated_cost_usd=settings.max_estimated_cost_usd,
                ),
            ),
            question,
        )

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
                correlation_id=context.correlation_id,
            )
            if settings.chat_provider == "bedrock"
            else DeterministicChatProvider()
        )
        return AgentWorkflow(
            context=context,
            provider=provider,
            specialists=build_specialists(registry),
            tool_event_source=lambda: registry.events,
            result_sink=PostgresGraphResultSink(settings.database_url.get_secret_value()),
        )


@lru_cache(maxsize=1)
def get_runtime() -> AgentRuntime:
    return AgentRuntime(load_settings())
