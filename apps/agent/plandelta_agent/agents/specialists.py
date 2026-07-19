from __future__ import annotations

from typing import Protocol

from plandelta_agent.guardrails import RunBudget
from plandelta_agent.models.evidence import EvidencePacket, SpecialistRole
from plandelta_agent.models.state import RunContext
from plandelta_agent.tools import ToolName, ToolRegistry


class SpecialistAgent(Protocol):
    role: SpecialistRole

    async def run(
        self,
        *,
        question: str,
        context: RunContext,
        budget: RunBudget,
    ) -> EvidencePacket: ...


class VisualEvidenceAgent:
    role = SpecialistRole.VISUAL

    def __init__(self, registry: ToolRegistry) -> None:
        self._registry = registry

    async def run(
        self,
        *,
        question: str,
        context: RunContext,
        budget: RunBudget,
    ) -> EvidencePacket:
        result = await self._registry.invoke(
            name=ToolName.LIST_VISUAL_CHANGES,
            specialist=self.role,
            arguments={"limit": min(8, context.limits.max_tool_calls + 4)},
            context=context,
            budget=budget,
        )
        return EvidencePacket(
            specialist=self.role,
            intent="visual_changes",
            evidence=result.evidence,
            warnings=result.warnings,
            insufficient_evidence=not result.evidence,
        )


class KnowledgeAgent:
    role = SpecialistRole.KNOWLEDGE

    def __init__(self, registry: ToolRegistry) -> None:
        self._registry = registry

    async def run(
        self,
        *,
        question: str,
        context: RunContext,
        budget: RunBudget,
    ) -> EvidencePacket:
        result = await self._registry.invoke(
            name=ToolName.HYBRID_SEARCH,
            specialist=self.role,
            arguments={
                "query": question,
                "limit": min(6, context.limits.max_retrieved_chunks),
            },
            context=context,
            budget=budget,
        )
        return EvidencePacket(
            specialist=self.role,
            intent="document_requirements",
            evidence=result.evidence,
            warnings=result.warnings,
            insufficient_evidence=not result.evidence,
        )


class ImpactAgent:
    role = SpecialistRole.IMPACT

    def __init__(self, registry: ToolRegistry) -> None:
        self._registry = registry

    async def run(
        self,
        *,
        question: str,
        context: RunContext,
        budget: RunBudget,
    ) -> EvidencePacket:
        rules = await self._registry.invoke(
            name=ToolName.APPLY_PROFILE_IMPACT_RULES,
            specialist=self.role,
            arguments={"question": question},
            context=context,
            budget=budget,
        )
        quantity = await self._registry.invoke(
            name=ToolName.CALCULATE_EVIDENCE_QUANTITY,
            specialist=self.role,
            arguments={"limit": 6},
            context=context,
            budget=budget,
        )
        evidence = [*rules.evidence, *quantity.evidence]
        return EvidencePacket(
            specialist=self.role,
            intent="coordination_impact",
            evidence=evidence,
            warnings=[*rules.warnings, *quantity.warnings],
            insufficient_evidence=not evidence,
        )


def build_specialists(registry: ToolRegistry) -> dict[SpecialistRole, SpecialistAgent]:
    agents: list[SpecialistAgent] = [
        VisualEvidenceAgent(registry),
        KnowledgeAgent(registry),
        ImpactAgent(registry),
    ]
    return {agent.role: agent for agent in agents}
