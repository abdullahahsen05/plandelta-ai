from uuid import uuid4

import pytest

from plandelta_agent.agents import ImpactAgent, KnowledgeAgent, VisualEvidenceAgent
from plandelta_agent.guardrails import RunBudget
from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import (
    AnalysisProfileId,
    EvidenceReference,
    SpecialistRole,
)
from plandelta_agent.models.state import RunContext, RunLimits
from plandelta_agent.tools import ToolDefinition, ToolName, ToolRegistry, ToolResult
from plandelta_agent.tools.implementations import (
    KnowledgeSearchArguments,
    ProfileImpactArguments,
    QuantityArguments,
    VisualChangesArguments,
)


def context() -> RunContext:
    return RunContext(
        owner_id=uuid4(),
        project_id=uuid4(),
        conversation_id=uuid4(),
        message_id=uuid4(),
        run_id=uuid4(),
        analysis_id=uuid4(),
        correlation_id="specialist-test",
        profile_id=AnalysisProfileId.CONSTRUCTION_DRAWING,
        limits=RunLimits(
            max_model_turns=3,
            max_tool_calls=6,
            max_retrieved_chunks=6,
            max_repair_passes=1,
            timeout_seconds=30,
            max_estimated_cost_usd=0.02,
        ),
    )


def evidence(scoped: RunContext, source_type: str) -> EvidenceReference:
    return EvidenceReference.model_validate(
        {
            "evidenceId": f"{source_type}:fixture",
            "sourceType": source_type,
            "projectId": scoped.project_id,
            "summary": f"Grounded {source_type} fixture.",
            "confidence": 0.9,
            "isActive": True,
            "isConflicting": False,
            "citationTarget": None,
        }
    )


def registry(calls: list[ToolName]) -> ToolRegistry:
    def handler(name: ToolName, source_type: str):
        async def invoke(_arguments: ContractModel, scoped: RunContext) -> ToolResult:
            calls.append(name)
            return ToolResult(evidence=[evidence(scoped, source_type)])

        return invoke

    return ToolRegistry(
        [
            ToolDefinition(
                name=ToolName.LIST_VISUAL_CHANGES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.VISUAL}),
                arguments_model=VisualChangesArguments,
                timeout_seconds=1,
                max_results=12,
                handler=handler(ToolName.LIST_VISUAL_CHANGES, "visual_change"),
            ),
            ToolDefinition(
                name=ToolName.HYBRID_SEARCH,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.KNOWLEDGE}),
                arguments_model=KnowledgeSearchArguments,
                timeout_seconds=1,
                max_results=12,
                handler=handler(ToolName.HYBRID_SEARCH, "document_chunk"),
            ),
            ToolDefinition(
                name=ToolName.APPLY_PROFILE_IMPACT_RULES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=ProfileImpactArguments,
                timeout_seconds=1,
                max_results=12,
                handler=handler(ToolName.APPLY_PROFILE_IMPACT_RULES, "profile_rule"),
            ),
            ToolDefinition(
                name=ToolName.CALCULATE_EVIDENCE_QUANTITY,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=QuantityArguments,
                timeout_seconds=1,
                max_results=12,
                handler=handler(ToolName.CALCULATE_EVIDENCE_QUANTITY, "visual_change"),
            ),
        ]
    )


@pytest.mark.anyio
async def test_visual_agent_uses_only_visual_tool() -> None:
    calls: list[ToolName] = []
    run_context = context()
    packet = await VisualEvidenceAgent(registry(calls)).run(
        question="What changed?",
        context=run_context,
        budget=RunBudget(run_context.limits),
    )

    assert calls == [ToolName.LIST_VISUAL_CHANGES]
    assert packet.specialist == SpecialistRole.VISUAL


@pytest.mark.anyio
async def test_knowledge_agent_uses_only_hybrid_search() -> None:
    calls: list[ToolName] = []
    run_context = context()
    packet = await KnowledgeAgent(registry(calls)).run(
        question="What does the specification require?",
        context=run_context,
        budget=RunBudget(run_context.limits),
    )

    assert calls == [ToolName.HYBRID_SEARCH]
    assert packet.specialist == SpecialistRole.KNOWLEDGE


@pytest.mark.anyio
async def test_impact_agent_uses_rules_and_evidence_quantity_only() -> None:
    calls: list[ToolName] = []
    run_context = context()
    packet = await ImpactAgent(registry(calls)).run(
        question="What is the coordination impact?",
        context=run_context,
        budget=RunBudget(run_context.limits),
    )

    assert calls == [
        ToolName.APPLY_PROFILE_IMPACT_RULES,
        ToolName.CALCULATE_EVIDENCE_QUANTITY,
    ]
    assert packet.specialist == SpecialistRole.IMPACT
