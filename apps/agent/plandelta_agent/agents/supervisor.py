from __future__ import annotations

from pydantic import Field

from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import SpecialistRole

_VISUAL_TERMS = frozenset(
    {
        "change",
        "changed",
        "drawing",
        "door",
        "image",
        "plan",
        "region",
        "removed",
        "revision",
        "visual",
        "wall",
        "window",
    }
)
_KNOWLEDGE_TERMS = frozenset(
    {
        "addendum",
        "document",
        "note",
        "require",
        "requirement",
        "rfi",
        "schedule",
        "spec",
        "specification",
        "technical",
    }
)
_IMPACT_TERMS = frozenset(
    {
        "coordination",
        "cost",
        "discipline",
        "impact",
        "quantity",
        "risk",
        "scope",
        "trade",
    }
)


class RoutingDecision(ContractModel):
    intent: str = Field(min_length=1, max_length=80)
    specialists: list[SpecialistRole] = Field(min_length=1, max_length=3)
    reason_codes: list[str] = Field(min_length=1, max_length=8)


def route_question(question: str, *, has_analysis: bool) -> RoutingDecision:
    words = {word.strip(".,?!:;()[]{}").casefold() for word in question.split()}
    visual = bool(words & _VISUAL_TERMS)
    knowledge = bool(words & _KNOWLEDGE_TERMS)
    impact = bool(words & _IMPACT_TERMS)

    specialists: list[SpecialistRole] = []
    reasons: list[str] = []
    if visual and has_analysis:
        specialists.append(SpecialistRole.VISUAL)
        reasons.append("QUESTION_NEEDS_VISUAL_EVIDENCE")
    if knowledge:
        specialists.append(SpecialistRole.KNOWLEDGE)
        reasons.append("QUESTION_NEEDS_PROJECT_DOCUMENTS")
    if impact:
        if has_analysis and SpecialistRole.VISUAL not in specialists:
            specialists.append(SpecialistRole.VISUAL)
            reasons.append("IMPACT_NEEDS_VISUAL_EVIDENCE")
        specialists.append(SpecialistRole.IMPACT)
        reasons.append("QUESTION_NEEDS_IMPACT_RULES")

    if not specialists:
        specialists.append(SpecialistRole.VISUAL if has_analysis else SpecialistRole.KNOWLEDGE)
        reasons.append("QUESTION_USES_DEFAULT_EVIDENCE_SCOPE")

    intent = (
        "combined_evidence"
        if len(specialists) > 1
        else {
            SpecialistRole.VISUAL: "visual_changes",
            SpecialistRole.KNOWLEDGE: "document_requirements",
            SpecialistRole.IMPACT: "coordination_impact",
        }[specialists[0]]
    )
    return RoutingDecision(intent=intent, specialists=specialists, reason_codes=reasons)
