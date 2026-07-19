from __future__ import annotations

from collections.abc import Sequence
from typing import cast
from uuid import UUID

import psycopg
from psycopg.rows import tuple_row
from pydantic import Field

from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import (
    DocumentCitationTarget,
    EvidenceReference,
    NormalizedBox,
    SpecialistRole,
    VisualCitationTarget,
)
from plandelta_agent.models.state import RunContext
from plandelta_agent.profiles import get_profile
from plandelta_agent.retrieval import HybridKnowledgeRetriever
from plandelta_agent.tools.registry import ToolDefinition, ToolName, ToolRegistry, ToolResult


class VisualChangesArguments(ContractModel):
    limit: int = Field(default=8, ge=1, le=12)


class KnowledgeSearchArguments(ContractModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=6, ge=1, le=12)


class ProfileImpactArguments(ContractModel):
    question: str = Field(min_length=1, max_length=1000)


class QuantityArguments(ContractModel):
    limit: int = Field(default=8, ge=1, le=12)


class PostgresEvidenceTools:
    def __init__(self, database_url: str, retriever: HybridKnowledgeRetriever) -> None:
        if not database_url:
            raise ValueError("A database URL is required.")
        self._database_url = database_url
        self._retriever = retriever

    async def list_visual_changes(
        self,
        arguments: ContractModel,
        context: RunContext,
    ) -> ToolResult:
        if not isinstance(arguments, VisualChangesArguments):
            raise TypeError("Visual change arguments are invalid.")
        if context.analysis_id is None:
            return ToolResult(warnings=["No analysis is scoped to this conversation."])
        async with (
            await psycopg.AsyncConnection.connect(
                self._database_url, row_factory=tuple_row
            ) as connection,
            connection.cursor() as cursor,
        ):
            await cursor.execute(
                """
                SELECT c.id, c.change_type::text, c.category::text, c.x, c.y, c.width,
                       c.height, c.confidence, c.old_text, c.new_text, c.affected_trades,
                       c.impact,
                       (
                         SELECT aa.id
                         FROM analysis_artifacts aa
                         WHERE aa.analysis_id = a.id
                           AND aa.kind IN ('OVERLAY', 'CANDIDATE_RENDER')
                         ORDER BY CASE WHEN aa.kind = 'OVERLAY' THEN 0 ELSE 1 END, aa.created_at
                         LIMIT 1
                       )
                FROM detected_changes c
                JOIN analyses a ON a.id = c.analysis_id
                JOIN projects p ON p.id = a.project_id
                WHERE c.analysis_id = %s
                  AND a.project_id = %s
                  AND p.owner_id = %s
                  AND a.status = 'COMPLETED'
                ORDER BY c.sequence
                LIMIT %s
                """,
                (
                    context.analysis_id,
                    context.project_id,
                    context.owner_id,
                    arguments.limit,
                ),
            )
            rows = await cursor.fetchall()
        return ToolResult(
            evidence=[self._visual_reference(context, row) for row in rows],
            warnings=(
                [] if rows else ["No completed visual changes were found in the scoped analysis."]
            ),
        )

    async def hybrid_search(
        self,
        arguments: ContractModel,
        context: RunContext,
    ) -> ToolResult:
        if not isinstance(arguments, KnowledgeSearchArguments):
            raise TypeError("Knowledge search arguments are invalid.")
        rows = await self._retriever.search(
            project_id=context.project_id,
            query=arguments.query,
            limit=min(arguments.limit, context.limits.max_retrieved_chunks),
        )
        return ToolResult(
            evidence=[
                EvidenceReference(
                    evidence_id=f"document:{row.chunk_id}",
                    source_type="document_chunk",
                    project_id=context.project_id,
                    source_id=row.chunk_id,
                    summary=(
                        f"{row.filename}, page {row.page_number}"
                        f"{f', {row.section_title}' if row.section_title else ''}: {row.excerpt}"
                    )[:800],
                    confidence=row.combined_score,
                    is_active=row.is_active,
                    is_conflicting=row.is_conflicting,
                    citation_target=DocumentCitationTarget(
                        type="document_chunk",
                        document_id=row.document_id,
                        document_version_id=row.document_version_id,
                        chunk_id=row.chunk_id,
                        page=row.page_number,
                        section=row.section_title,
                        excerpt=row.excerpt,
                        is_active=row.is_active,
                        is_conflicting=row.is_conflicting,
                    ),
                )
                for row in rows
            ],
            warnings=[] if rows else ["No matching ready project documents were found."],
        )

    async def apply_profile_rules(
        self,
        arguments: ContractModel,
        context: RunContext,
    ) -> ToolResult:
        if not isinstance(arguments, ProfileImpactArguments):
            raise TypeError("Profile impact arguments are invalid.")
        profile = get_profile(context.profile_id)
        return ToolResult(
            evidence=[
                EvidenceReference(
                    evidence_id=f"profile:{profile.id.value}:{rule.code}",
                    source_type="profile_rule",
                    project_id=context.project_id,
                    summary=rule.summary,
                    confidence=1,
                    is_active=True,
                    is_conflicting=False,
                )
                for rule in profile.rules
            ],
            warnings=[profile.disclaimer],
        )

    async def calculate_evidence_quantity(
        self,
        arguments: ContractModel,
        context: RunContext,
    ) -> ToolResult:
        if not isinstance(arguments, QuantityArguments):
            raise TypeError("Quantity arguments are invalid.")
        if context.analysis_id is None:
            return ToolResult(warnings=["No analysis is scoped for quantity evidence."])
        async with (
            await psycopg.AsyncConnection.connect(
                self._database_url, row_factory=tuple_row
            ) as connection,
            connection.cursor() as cursor,
        ):
            await cursor.execute(
                """
                SELECT c.id, c.change_type::text, c.category::text, c.quantity_delta::text,
                       c.unit, c.x, c.y, c.width, c.height, c.confidence
                FROM detected_changes c
                JOIN analyses a ON a.id = c.analysis_id
                JOIN projects p ON p.id = a.project_id
                WHERE c.analysis_id = %s
                  AND a.project_id = %s
                  AND p.owner_id = %s
                  AND c.quantity_delta IS NOT NULL
                  AND c.unit IS NOT NULL
                ORDER BY c.sequence
                LIMIT %s
                """,
                (
                    context.analysis_id,
                    context.project_id,
                    context.owner_id,
                    arguments.limit,
                ),
            )
            rows = await cursor.fetchall()
        evidence = [
            EvidenceReference(
                evidence_id=f"quantity:{cast(UUID, row[0])}",
                source_type="visual_change",
                project_id=context.project_id,
                analysis_id=context.analysis_id,
                source_id=cast(UUID, row[0]),
                summary=(
                    f"Recorded evidence delta: {row[1]} {row[2]}, "
                    f"{row[3]} {row[4]}. Not a takeoff or cost estimate."
                ),
                confidence=float(cast(float, row[9])),
                is_active=True,
                is_conflicting=False,
                citation_target=VisualCitationTarget(
                    type="visual_change",
                    analysis_id=context.analysis_id,
                    change_id=cast(UUID, row[0]),
                    region=NormalizedBox(
                        x=float(cast(float, row[5])),
                        y=float(cast(float, row[6])),
                        width=float(cast(float, row[7])),
                        height=float(cast(float, row[8])),
                    ),
                ),
            )
            for row in rows
        ]
        return ToolResult(
            evidence=evidence,
            warnings=[] if evidence else ["No measured quantity deltas exist in this analysis."],
        )

    @staticmethod
    def _visual_reference(
        context: RunContext,
        row: Sequence[object],
    ) -> EvidenceReference:
        change_id = cast(UUID, row[0])
        change_type = cast(str, row[1])
        category = cast(str, row[2])
        raw_old_text = cast(str | None, row[8])
        raw_new_text = cast(str | None, row[9])
        old_text = " ".join(raw_old_text.split())[:120] if raw_old_text else None
        new_text = " ".join(raw_new_text.split())[:120] if raw_new_text else None
        affected_trades = cast(list[str], row[10])
        detail = f"{change_type} {category}"
        if old_text or new_text:
            detail += f"; text {old_text or '[none]'} -> {new_text or '[none]'}"
        if affected_trades:
            detail += f"; affected trades: {', '.join(affected_trades[:6])}"
        return EvidenceReference(
            evidence_id=f"visual:{change_id}",
            source_type="visual_change",
            project_id=context.project_id,
            analysis_id=context.analysis_id,
            source_id=change_id,
            summary=detail[:800],
            confidence=float(cast(float, row[7])),
            is_active=True,
            is_conflicting=False,
            citation_target=VisualCitationTarget(
                type="visual_change",
                analysis_id=cast(UUID, context.analysis_id),
                change_id=change_id,
                artifact_id=cast(UUID | None, row[12]),
                region=NormalizedBox(
                    x=float(cast(float, row[3])),
                    y=float(cast(float, row[4])),
                    width=float(cast(float, row[5])),
                    height=float(cast(float, row[6])),
                ),
            ),
        )


def build_tool_registry(tools: PostgresEvidenceTools) -> ToolRegistry:
    return ToolRegistry(
        [
            ToolDefinition(
                name=ToolName.LIST_VISUAL_CHANGES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.VISUAL}),
                arguments_model=VisualChangesArguments,
                timeout_seconds=8,
                max_results=12,
                handler=tools.list_visual_changes,
            ),
            ToolDefinition(
                name=ToolName.HYBRID_SEARCH,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.KNOWLEDGE}),
                arguments_model=KnowledgeSearchArguments,
                timeout_seconds=15,
                max_results=12,
                handler=tools.hybrid_search,
            ),
            ToolDefinition(
                name=ToolName.APPLY_PROFILE_IMPACT_RULES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=ProfileImpactArguments,
                timeout_seconds=2,
                max_results=20,
                handler=tools.apply_profile_rules,
            ),
            ToolDefinition(
                name=ToolName.CALCULATE_EVIDENCE_QUANTITY,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=QuantityArguments,
                timeout_seconds=8,
                max_results=12,
                handler=tools.calculate_evidence_quantity,
            ),
        ]
    )
