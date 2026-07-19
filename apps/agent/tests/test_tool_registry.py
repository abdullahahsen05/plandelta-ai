from uuid import uuid4

import pytest
from pydantic import Field

from plandelta_agent.guardrails import RunBudget
from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import (
    AnalysisProfileId,
    EvidenceReference,
    SpecialistRole,
)
from plandelta_agent.models.state import RunContext, RunLimits
from plandelta_agent.tools import (
    ToolDefinition,
    ToolExecutionError,
    ToolName,
    ToolPolicyError,
    ToolRegistry,
    ToolResult,
)


class QueryArguments(ContractModel):
    query: str = Field(min_length=1, max_length=200)


def context() -> RunContext:
    return RunContext(
        owner_id=uuid4(),
        project_id=uuid4(),
        conversation_id=uuid4(),
        message_id=uuid4(),
        run_id=uuid4(),
        analysis_id=uuid4(),
        correlation_id="test-correlation",
        profile_id=AnalysisProfileId.CONSTRUCTION_DRAWING,
        limits=RunLimits(
            max_model_turns=3,
            max_tool_calls=3,
            max_retrieved_chunks=4,
            max_repair_passes=1,
            timeout_seconds=30,
            max_estimated_cost_usd=0.02,
        ),
    )


@pytest.mark.anyio
async def test_registry_uses_server_scope_and_returns_typed_evidence() -> None:
    run_context = context()

    async def handler(arguments: ContractModel, scoped: RunContext) -> ToolResult:
        assert isinstance(arguments, QueryArguments)
        return ToolResult(
            evidence=[
                EvidenceReference(
                    evidence_id="doc:1",
                    source_type="profile_rule",
                    project_id=scoped.project_id,
                    summary="Partition revisions require trade coordination review.",
                    confidence=1,
                    is_active=True,
                    is_conflicting=False,
                )
            ]
        )

    registry = ToolRegistry(
        [
            ToolDefinition(
                name=ToolName.APPLY_PROFILE_IMPACT_RULES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=QueryArguments,
                timeout_seconds=1,
                max_results=2,
                handler=handler,
            )
        ]
    )
    result = await registry.invoke(
        name=ToolName.APPLY_PROFILE_IMPACT_RULES,
        specialist=SpecialistRole.IMPACT,
        arguments={"query": "partition"},
        context=run_context,
        budget=RunBudget(run_context.limits),
    )

    assert result.evidence[0].project_id == run_context.project_id
    assert registry.events[0].status == "completed"
    assert registry.events[0].result_count == 1


@pytest.mark.anyio
async def test_registry_rejects_model_scope_and_wrong_role() -> None:
    run_context = context()

    async def handler(_arguments: ContractModel, _context: RunContext) -> ToolResult:
        return ToolResult()

    registry = ToolRegistry(
        [
            ToolDefinition(
                name=ToolName.HYBRID_SEARCH,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.KNOWLEDGE}),
                arguments_model=QueryArguments,
                timeout_seconds=1,
                max_results=2,
                handler=handler,
            )
        ]
    )

    with pytest.raises(ToolPolicyError, match="AGENT_TOOL_SCOPE_OVERRIDE"):
        await registry.invoke(
            name=ToolName.HYBRID_SEARCH,
            specialist=SpecialistRole.KNOWLEDGE,
            arguments={"query": "partition", "project_id": str(uuid4())},
            context=run_context,
            budget=RunBudget(run_context.limits),
        )
    with pytest.raises(ToolPolicyError, match="AGENT_TOOL_ROLE_DENIED"):
        await registry.invoke(
            name=ToolName.HYBRID_SEARCH,
            specialist=SpecialistRole.VISUAL,
            arguments={"query": "partition"},
            context=run_context,
            budget=RunBudget(run_context.limits),
        )


@pytest.mark.anyio
async def test_registry_rejects_malformed_missing_and_cross_project_evidence() -> None:
    run_context = context()

    async def missing(_arguments: ContractModel, _context: RunContext) -> ToolResult:
        raise ToolExecutionError("AGENT_ARTIFACT_MISSING")

    missing_registry = ToolRegistry(
        [
            ToolDefinition(
                name=ToolName.GET_VISUAL_EVIDENCE,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.VISUAL}),
                arguments_model=QueryArguments,
                timeout_seconds=1,
                max_results=2,
                handler=missing,
            )
        ]
    )
    with pytest.raises(ToolPolicyError, match="AGENT_TOOL_ARGUMENTS_INVALID"):
        await missing_registry.invoke(
            name=ToolName.GET_VISUAL_EVIDENCE,
            specialist=SpecialistRole.VISUAL,
            arguments={"unexpected": "value"},
            context=run_context,
            budget=RunBudget(run_context.limits),
        )
    with pytest.raises(ToolPolicyError, match="AGENT_ARTIFACT_MISSING"):
        await missing_registry.invoke(
            name=ToolName.GET_VISUAL_EVIDENCE,
            specialist=SpecialistRole.VISUAL,
            arguments={"query": "region"},
            context=run_context,
            budget=RunBudget(run_context.limits),
        )

    async def cross_project(_arguments: ContractModel, _context: RunContext) -> ToolResult:
        return ToolResult(
            evidence=[
                EvidenceReference(
                    evidence_id="other-project:evidence",
                    source_type="profile_rule",
                    project_id=uuid4(),
                    summary="Evidence from a different project.",
                    confidence=1,
                    is_active=True,
                    is_conflicting=False,
                )
            ]
        )

    cross_registry = ToolRegistry(
        [
            ToolDefinition(
                name=ToolName.APPLY_PROFILE_IMPACT_RULES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=QueryArguments,
                timeout_seconds=1,
                max_results=2,
                handler=cross_project,
            )
        ]
    )
    with pytest.raises(ToolPolicyError, match="AGENT_TOOL_SCOPE_VIOLATION"):
        await cross_registry.invoke(
            name=ToolName.APPLY_PROFILE_IMPACT_RULES,
            specialist=SpecialistRole.IMPACT,
            arguments={"query": "scope"},
            context=run_context,
            budget=RunBudget(run_context.limits),
        )
