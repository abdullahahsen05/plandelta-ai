from __future__ import annotations

from pydantic import Field

from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import AnalysisProfileId


class ProfileRule(ContractModel):
    code: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=500)
    categories: list[str] = Field(default_factory=list, max_length=12)
    affected_roles: list[str] = Field(default_factory=list, max_length=12)


class AnalysisProfile(ContractModel):
    id: AnalysisProfileId
    version: str = Field(min_length=1, max_length=40)
    vocabulary: str = Field(min_length=1, max_length=120)
    categories: list[str] = Field(min_length=1, max_length=20)
    affected_roles: list[str] = Field(min_length=1, max_length=20)
    prompt_context: str = Field(min_length=1, max_length=500)
    rules: list[ProfileRule] = Field(min_length=1, max_length=20)
    disclaimer: str = Field(min_length=1, max_length=500)


PROFILES: dict[AnalysisProfileId, AnalysisProfile] = {
    AnalysisProfileId.CONSTRUCTION_DRAWING: AnalysisProfile(
        id=AnalysisProfileId.CONSTRUCTION_DRAWING,
        version="1.0",
        vocabulary="construction drawing revisions",
        categories=[
            "WALL_LINEWORK",
            "DOOR",
            "WINDOW",
            "FIXTURE_SYMBOL",
            "DIMENSION",
            "TEXT_NOTE",
            "ROOM_LABEL",
            "UNKNOWN",
        ],
        affected_roles=[
            "architectural",
            "structural",
            "doors and hardware",
            "glazing",
            "MEP",
            "estimating",
            "finishes",
        ],
        prompt_context=(
            "Use construction coordination vocabulary. Describe walls, openings, fixtures, "
            "dimensions, room labels, notes, and affected trades only when evidence supports them."
        ),
        rules=[
            ProfileRule(
                code="CONSTRUCTION_COORDINATION",
                summary=(
                    "Changed walls, openings, fixtures, dimensions, and notes may require "
                    "coordination with the affected trades recorded in the visual evidence."
                ),
                categories=["WALL_LINEWORK", "DOOR", "WINDOW", "FIXTURE_SYMBOL"],
                affected_roles=["architectural", "structural", "MEP"],
            ),
            ProfileRule(
                code="CONSTRUCTION_QUANTITY",
                summary=(
                    "Quantity observations are evidence deltas only and are not a takeoff, "
                    "cost estimate, approval, or code-compliance decision."
                ),
                categories=["DIMENSION"],
                affected_roles=["estimating", "all trades"],
            ),
        ],
        disclaimer=(
            "Decision support only. Verify findings against the source drawings and project "
            "documents before coordination, procurement, or construction."
        ),
    ),
    AnalysisProfileId.ENGINEERING_SCHEMATIC: AnalysisProfile(
        id=AnalysisProfileId.ENGINEERING_SCHEMATIC,
        version="1.0",
        vocabulary="engineering schematic revisions",
        categories=[
            "COMPONENT",
            "CONNECTION_LINE",
            "LABEL",
            "NOTE",
            "DIMENSION",
            "UNKNOWN",
        ],
        affected_roles=[
            "engineering",
            "electrical",
            "controls",
            "instrumentation",
            "fabrication",
            "documentation",
        ],
        prompt_context=(
            "Use engineering-schematic vocabulary. Distinguish components, connection lines, "
            "identifiers, notes, and dimensions. Never infer circuit correctness or design safety."
        ),
        rules=[
            ProfileRule(
                code="SCHEMATIC_COORDINATION",
                summary=(
                    "Changed components, connections, identifiers, notes, or values may require "
                    "electrical, controls, instrumentation, mechanical, or documentation review."
                ),
                categories=["COMPONENT", "CONNECTION_LINE", "LABEL", "NOTE"],
                affected_roles=["electrical", "controls", "instrumentation", "documentation"],
            ),
            ProfileRule(
                code="SCHEMATIC_SAFETY_BOUNDARY",
                summary=(
                    "The evidence cannot establish circuit correctness, safety certification, "
                    "regulatory compliance, or operational fitness."
                ),
                categories=["COMPONENT", "CONNECTION_LINE", "DIMENSION"],
                affected_roles=["engineering"],
            ),
        ],
        disclaimer=(
            "Revision evidence only. A qualified engineer must verify design intent, safety, "
            "and compliance."
        ),
    ),
}


def get_profile(profile_id: AnalysisProfileId) -> AnalysisProfile:
    return PROFILES[profile_id]
