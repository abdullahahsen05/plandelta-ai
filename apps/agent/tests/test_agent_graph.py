from __future__ import annotations

import asyncio
import json
import time
from typing import cast
from uuid import UUID, uuid4

import pytest
from pydantic import Field

from plandelta_agent.agents import build_specialists
from plandelta_agent.graph import AgentWorkflow
from plandelta_agent.guardrails import RunBudget
from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import (
    AnalysisProfileId,
    EvidencePacket,
    EvidenceReference,
    NormalizedBox,
    SpecialistRole,
    VisualCitationTarget,
)
from plandelta_agent.models.state import RunContext, RunLimits
from plandelta_agent.providers import DeterministicChatProvider
from plandelta_agent.tools import ToolDefinition, ToolName, ToolRegistry, ToolResult
from plandelta_agent.tools.implementations import (
    ProfileImpactArguments,
    QuantityArguments,
    VisualChangesArguments,
)

VISUAL_EVIDENCE_ID = "visual:fixture-change"


class FixtureSpecialist:
    def __init__(self, role: SpecialistRole, calls: list[SpecialistRole]) -> None:
        self.role = role
        self._calls = calls

    async def run(
        self,
        *,
        question: str,
        context: RunContext,
        budget: RunBudget,
    ) -> EvidencePacket:
        self._calls.append(self.role)
        if self.role == SpecialistRole.VISUAL:
            change_id = uuid4()
            return EvidencePacket(
                specialist=self.role,
                intent="visual_changes",
                evidence=[
                    EvidenceReference(
                        evidence_id=VISUAL_EVIDENCE_ID,
                        source_type="visual_change",
                        project_id=context.project_id,
                        analysis_id=context.analysis_id,
                        source_id=change_id,
                        summary="One wall change is recorded in evidence region 01.",
                        confidence=0.91,
                        is_active=True,
                        is_conflicting=False,
                        citation_target=VisualCitationTarget(
                            type="visual_change",
                            analysis_id=cast(UUID, context.analysis_id),
                            change_id=change_id,
                            region=NormalizedBox(x=0.1, y=0.1, width=0.2, height=0.3),
                        ),
                    )
                ],
                insufficient_evidence=False,
            )
        return EvidencePacket(
            specialist=self.role,
            intent=(
                "document_requirements"
                if self.role == SpecialistRole.KNOWLEDGE
                else "coordination_impact"
            ),
            evidence=[
                EvidenceReference(
                    evidence_id=f"profile:{self.role.value}",
                    source_type="profile_rule",
                    project_id=context.project_id,
                    summary=f"Fixture rule for {self.role.value}.",
                    confidence=1,
                    is_active=True,
                    is_conflicting=False,
                )
            ],
            insufficient_evidence=False,
        )


class SlowFixtureSpecialist(FixtureSpecialist):
    def __init__(
        self,
        role: SpecialistRole,
        calls: list[SpecialistRole],
        delay_seconds: float,
    ) -> None:
        super().__init__(role, calls)
        self._delay_seconds = delay_seconds

    async def run(
        self,
        *,
        question: str,
        context: RunContext,
        budget: RunBudget,
    ) -> EvidencePacket:
        await asyncio.sleep(self._delay_seconds)
        return await super().run(
            question=question,
            context=context,
            budget=budget,
        )


def context() -> RunContext:
    return RunContext(
        owner_id=uuid4(),
        project_id=uuid4(),
        conversation_id=uuid4(),
        message_id=uuid4(),
        run_id=uuid4(),
        analysis_id=uuid4(),
        correlation_id="graph-test",
        profile_id=AnalysisProfileId.CONSTRUCTION_DRAWING,
        limits=RunLimits(
            max_model_turns=3,
            max_tool_calls=8,
            max_retrieved_chunks=6,
            max_repair_passes=1,
            timeout_seconds=30,
            max_estimated_cost_usd=0.02,
        ),
    )


def response(
    *,
    answer: str = "One wall change is recorded.",
    evidence_ids: list[str] | None = None,
) -> str:
    return json.dumps(
        {
            "answerMarkdown": answer,
            "confidence": "medium",
            "citedEvidenceIds": evidence_ids or [VISUAL_EVIDENCE_ID],
            "draftRfi": False,
        }
    )


def specialists(calls: list[SpecialistRole]) -> dict[SpecialistRole, FixtureSpecialist]:
    return {role: FixtureSpecialist(role, calls) for role in SpecialistRole}


class EmptyArguments(ContractModel):
    limit: int = Field(default=6, ge=1, le=12)


def real_registry(run_context: RunContext, calls: list[ToolName]) -> ToolRegistry:
    async def visual(_arguments: ContractModel, scoped: RunContext) -> ToolResult:
        calls.append(ToolName.LIST_VISUAL_CHANGES)
        change_id = uuid4()
        return ToolResult(
            evidence=[
                EvidenceReference(
                    evidence_id=VISUAL_EVIDENCE_ID,
                    source_type="visual_change",
                    project_id=scoped.project_id,
                    analysis_id=scoped.analysis_id,
                    source_id=change_id,
                    summary="One grounded wall change.",
                    confidence=0.9,
                    is_active=True,
                    is_conflicting=False,
                    citation_target=VisualCitationTarget(
                        type="visual_change",
                        analysis_id=cast(UUID, scoped.analysis_id),
                        change_id=change_id,
                        region=NormalizedBox(x=0.1, y=0.1, width=0.2, height=0.2),
                    ),
                )
            ]
        )

    async def profile(_arguments: ContractModel, scoped: RunContext) -> ToolResult:
        calls.append(ToolName.APPLY_PROFILE_IMPACT_RULES)
        return ToolResult(
            evidence=[
                EvidenceReference(
                    evidence_id="profile:fixture",
                    source_type="profile_rule",
                    project_id=scoped.project_id,
                    summary="Coordinate affected trades; this is not an approval.",
                    confidence=1,
                    is_active=True,
                    is_conflicting=False,
                )
            ]
        )

    async def quantity(_arguments: ContractModel, _scoped: RunContext) -> ToolResult:
        calls.append(ToolName.CALCULATE_EVIDENCE_QUANTITY)
        return ToolResult(warnings=["No measured quantity delta."])

    return ToolRegistry(
        [
            ToolDefinition(
                name=ToolName.LIST_VISUAL_CHANGES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.VISUAL}),
                arguments_model=VisualChangesArguments,
                timeout_seconds=1,
                max_results=12,
                handler=visual,
            ),
            ToolDefinition(
                name=ToolName.APPLY_PROFILE_IMPACT_RULES,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=ProfileImpactArguments,
                timeout_seconds=1,
                max_results=12,
                handler=profile,
            ),
            ToolDefinition(
                name=ToolName.CALCULATE_EVIDENCE_QUANTITY,
                version="1",
                allowed_specialists=frozenset({SpecialistRole.IMPACT}),
                arguments_model=QuantityArguments,
                timeout_seconds=1,
                max_results=12,
                handler=quantity,
            ),
        ]
    )


@pytest.mark.anyio
async def test_graph_routes_real_specialist_and_requires_verifier_approval() -> None:
    calls: list[SpecialistRole] = []
    provider = DeterministicChatProvider([response()])
    result = await AgentWorkflow(
        context=context(),
        provider=provider,
        specialists=specialists(calls),
    ).execute("What changed in the drawing?")

    assert calls == [SpecialistRole.VISUAL]
    assert result.verifier.approved is True
    assert result.answer.status == "verified"
    assert result.answer.citations[0].verified is True
    assert [record.node for record in result.trace] == [
        "intake",
        "supervisor",
        "specialists",
        "synthesis",
        "verifier",
    ]


@pytest.mark.anyio
async def test_graph_repairs_one_hallucinated_source_then_terminates() -> None:
    calls: list[SpecialistRole] = []
    provider = DeterministicChatProvider(
        [
            response(evidence_ids=["visual:not-returned"]),
            response(),
        ]
    )
    result = await AgentWorkflow(
        context=context(),
        provider=provider,
        specialists=specialists(calls),
    ).execute("What changed in the plan?")

    assert provider.call_count == 2
    assert result.repair_passes == 1
    assert result.verifier.approved is True
    assert any(record.node == "repair" for record in result.trace)


@pytest.mark.anyio
async def test_graph_uses_hard_safe_fallback_after_second_verifier_rejection() -> None:
    calls: list[SpecialistRole] = []
    unsafe = response(answer="This revision is approved and safe to construct.")
    provider = DeterministicChatProvider([unsafe, unsafe])
    result = await AgentWorkflow(
        context=context(),
        provider=provider,
        specialists=specialists(calls),
    ).execute("Is the wall revision approved?")

    assert provider.call_count == 2
    assert result.verifier.approved is False
    assert result.answer.status == "insufficient_evidence"
    assert result.answer.provider == "deterministic"
    assert "could not verify" in result.answer.answer_markdown
    assert result.repair_passes == 1


@pytest.mark.anyio
async def test_combined_question_fans_out_without_private_content_in_trace() -> None:
    calls: list[SpecialistRole] = []
    provider = DeterministicChatProvider([response()])
    result = await AgentWorkflow(
        context=context(),
        provider=provider,
        specialists=specialists(calls),
    ).execute("What coordination impact could this wall change have?")

    assert calls == [SpecialistRole.VISUAL, SpecialistRole.IMPACT]
    trace_json = json.dumps([record.model_dump(mode="json") for record in result.trace])
    assert "wall change" not in trace_json
    assert "Fixture rule" not in trace_json
    # Fixture specialists do not bypass the real registry in production.
    assert result.tool_calls == 0


@pytest.mark.anyio
async def test_graph_executes_allowlisted_tools_through_real_specialists() -> None:
    tool_calls: list[ToolName] = []
    run_context = context()
    registry = real_registry(run_context, tool_calls)
    result = await AgentWorkflow(
        context=run_context,
        provider=DeterministicChatProvider([response()]),
        specialists=build_specialists(registry),
        tool_event_source=lambda: registry.events,
    ).execute("What coordination impact could this wall change have?")

    assert set(tool_calls) == {
        ToolName.LIST_VISUAL_CHANGES,
        ToolName.APPLY_PROFILE_IMPACT_RULES,
        ToolName.CALCULATE_EVIDENCE_QUANTITY,
    }
    assert result.tool_calls == 3
    assert result.verifier.approved is True
    assert {record.node for record in result.trace if record.node.startswith("tool.")} == {
        "tool.list_visual_changes",
        "tool.apply_profile_impact_rules",
        "tool.calculate_evidence_quantity",
    }


@pytest.mark.anyio
async def test_specialists_run_in_parallel_and_timeout_is_terminal() -> None:
    calls: list[SpecialistRole] = []
    run_context = context()
    delayed = {
        role: SlowFixtureSpecialist(role, calls, 0.08)
        for role in SpecialistRole
    }
    started = time.perf_counter()
    result = await AgentWorkflow(
        context=run_context,
        provider=DeterministicChatProvider([response()]),
        specialists=delayed,
    ).execute("What coordination impact could this wall change have?")
    elapsed = time.perf_counter() - started

    assert result.verifier.approved is True
    assert elapsed < 0.15

    timeout_context = context()
    object.__setattr__(timeout_context.limits, "timeout_seconds", 0.01)
    timed_out = await AgentWorkflow(
        context=timeout_context,
        provider=DeterministicChatProvider([response()]),
        specialists={
            role: SlowFixtureSpecialist(role, [], 0.08)
            for role in SpecialistRole
        },
    ).execute("What changed in the drawing?")

    assert timed_out.safe_error is not None
    assert timed_out.safe_error.code == "AGENT_TIMEOUT"
    assert timed_out.answer.status == "insufficient_evidence"
