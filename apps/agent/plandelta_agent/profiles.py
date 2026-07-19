from __future__ import annotations

from pydantic import Field

from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import AnalysisProfileId


class ProfileRule(ContractModel):
    code: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=500)


class AnalysisProfile(ContractModel):
    id: AnalysisProfileId
    version: str = Field(min_length=1, max_length=40)
    vocabulary: str = Field(min_length=1, max_length=120)
    rules: list[ProfileRule] = Field(min_length=1, max_length=20)
    disclaimer: str = Field(min_length=1, max_length=500)


PROFILES: dict[AnalysisProfileId, AnalysisProfile] = {
    AnalysisProfileId.CONSTRUCTION_DRAWING: AnalysisProfile(
        id=AnalysisProfileId.CONSTRUCTION_DRAWING,
        version="1.0",
        vocabulary="construction drawing revisions",
        rules=[
            ProfileRule(
                code="CONSTRUCTION_COORDINATION",
                summary=(
                    "Changed walls, openings, fixtures, dimensions, and notes may require "
                    "coordination with the affected trades recorded in the visual evidence."
                ),
            ),
            ProfileRule(
                code="CONSTRUCTION_QUANTITY",
                summary=(
                    "Quantity observations are evidence deltas only and are not a takeoff, "
                    "cost estimate, approval, or code-compliance decision."
                ),
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
        rules=[
            ProfileRule(
                code="SCHEMATIC_COORDINATION",
                summary=(
                    "Changed components, connections, identifiers, notes, or values may require "
                    "electrical, controls, instrumentation, mechanical, or documentation review."
                ),
            ),
            ProfileRule(
                code="SCHEMATIC_SAFETY_BOUNDARY",
                summary=(
                    "The evidence cannot establish circuit correctness, safety certification, "
                    "regulatory compliance, or operational fitness."
                ),
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
