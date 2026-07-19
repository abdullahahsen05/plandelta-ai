from __future__ import annotations

from plandelta_agent.models.evidence import AnalysisProfileId
from plandelta_agent.profiles import get_profile


def test_required_profiles_have_distinct_verified_categories() -> None:
    construction = get_profile(AnalysisProfileId.CONSTRUCTION_DRAWING)
    schematic = get_profile(AnalysisProfileId.ENGINEERING_SCHEMATIC)

    assert "WALL_LINEWORK" in construction.categories
    assert {"COMPONENT", "CONNECTION_LINE", "LABEL", "NOTE", "DIMENSION", "UNKNOWN"} <= set(
        schematic.categories
    )
    assert construction.prompt_context != schematic.prompt_context
    assert "safety" in schematic.disclaimer.lower()
