from __future__ import annotations

import re

from plandelta_vision.differ import PixelRegion


def classify_region(
    region: PixelRegion,
    old_text: str | None,
    new_text: str | None,
) -> tuple[str, list[str], str]:
    text = " ".join(value for value in [old_text, new_text] if value).lower()
    aspect = region.width / max(1, region.height)
    if re.search(r"\b\d+[ '-]?\d*(?:[\"']|mm|cm|m|ft)\b", text):
        return (
            "DIMENSION",
            ["estimating", "all trades"],
            "Verify revised dimensions and quantities.",
        )
    if any(word in text for word in ["room", "office", "lobby", "corridor", "toilet", "bed"]):
        return (
            "ROOM_LABEL",
            ["architectural", "finishes"],
            "Review room identity and finish coordination.",
        )
    if text:
        return "TEXT_NOTE", ["architectural", "estimating"], "Review revised note requirements."
    if aspect >= 4.0 or aspect <= 0.25:
        return (
            "WALL_LINEWORK",
            ["architectural", "structural"],
            "Verify wall or linework coordination.",
        )
    if 0.65 <= aspect <= 1.55 and max(region.width, region.height) >= 30:
        return (
            "DOOR",
            ["architectural", "doors and hardware"],
            "Verify opening and hardware coordination.",
        )
    if aspect >= 1.8:
        return "WINDOW", ["architectural", "glazing"], "Verify opening and glazing coordination."
    return "FIXTURE_SYMBOL", ["architectural", "MEP"], "Verify symbol and fixture coordination."
