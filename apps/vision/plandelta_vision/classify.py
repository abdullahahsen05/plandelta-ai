from __future__ import annotations

import re
from typing import Literal

from plandelta_vision.differ import PixelRegion

Category = Literal[
    "WALL_LINEWORK",
    "DOOR",
    "WINDOW",
    "FIXTURE_SYMBOL",
    "DIMENSION",
    "TEXT_NOTE",
    "ROOM_LABEL",
    "UNKNOWN",
]


def classification_details(category: Category) -> tuple[list[str], str]:
    details: dict[Category, tuple[list[str], str]] = {
        "WALL_LINEWORK": (
            ["architectural", "structural"],
            "Verify wall or linework coordination.",
        ),
        "DOOR": (
            ["architectural", "doors and hardware"],
            "Verify opening and hardware coordination.",
        ),
        "WINDOW": (
            ["architectural", "glazing"],
            "Verify opening and glazing coordination.",
        ),
        "FIXTURE_SYMBOL": (
            ["architectural", "MEP"],
            "Verify symbol and fixture coordination.",
        ),
        "DIMENSION": (
            ["estimating", "all trades"],
            "Verify revised dimensions and quantities.",
        ),
        "TEXT_NOTE": (
            ["architectural", "estimating"],
            "Review revised note requirements.",
        ),
        "ROOM_LABEL": (
            ["architectural", "finishes"],
            "Review room identity and finish coordination.",
        ),
        "UNKNOWN": (
            ["architectural"],
            "Review the unclassified revision evidence against both drawings.",
        ),
    }
    return details[category]


def classify_region(
    region: PixelRegion,
    old_text: str | None,
    new_text: str | None,
) -> tuple[Category, list[str], str]:
    text = " ".join(value for value in [old_text, new_text] if value).lower()
    aspect = region.width / max(1, region.height)
    if re.search(r"\b\d+[ '-]?\d*(?:[\"']|mm|cm|m|ft)\b", text):
        category: Category = "DIMENSION"
        trades, impact = classification_details(category)
        return category, trades, impact
    if any(word in text for word in ["room", "office", "lobby", "corridor", "toilet", "bed"]):
        category = "ROOM_LABEL"
        trades, impact = classification_details(category)
        return category, trades, impact
    if text:
        category = "TEXT_NOTE"
        trades, impact = classification_details(category)
        return category, trades, impact
    if aspect >= 4.0 or aspect <= 0.25:
        category = "WALL_LINEWORK"
        trades, impact = classification_details(category)
        return category, trades, impact
    if 0.65 <= aspect <= 1.55 and max(region.width, region.height) >= 30:
        category = "DOOR"
        trades, impact = classification_details(category)
        return category, trades, impact
    if aspect >= 1.8:
        category = "WINDOW"
        trades, impact = classification_details(category)
        return category, trades, impact
    category = "FIXTURE_SYMBOL"
    trades, impact = classification_details(category)
    return category, trades, impact
