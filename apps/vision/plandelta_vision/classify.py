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
    "COMPONENT",
    "CONNECTION_LINE",
    "LABEL",
    "NOTE",
    "UNKNOWN",
]
AnalysisProfile = Literal["construction_drawing", "engineering_schematic"]


def classification_details(
    category: Category,
    profile: AnalysisProfile = "construction_drawing",
) -> tuple[list[str], str]:
    if profile == "engineering_schematic":
        schematic_details: dict[Category, tuple[list[str], str]] = {
            "COMPONENT": (
                ["electrical", "controls", "instrumentation"],
                "Verify the revised component identity, rating, and connected references.",
            ),
            "CONNECTION_LINE": (
                ["electrical", "controls", "instrumentation"],
                "Verify connection continuity, endpoints, and signal or circuit references.",
            ),
            "LABEL": (
                ["engineering", "documentation"],
                "Verify the revised identifier everywhere it is referenced.",
            ),
            "NOTE": (
                ["engineering", "documentation"],
                "Review the revised schematic note against the governing design intent.",
            ),
            "DIMENSION": (
                ["engineering", "fabrication"],
                "Verify the revised dimension or value before fabrication or installation.",
            ),
            "UNKNOWN": (
                ["engineering"],
                "Review the unclassified schematic revision against both source sheets.",
            ),
        }
        return schematic_details.get(
            category,
            (
                ["engineering"],
                "Review this schematic revision against both source sheets.",
            ),
        )
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
    profile: AnalysisProfile = "construction_drawing",
) -> tuple[Category, list[str], str]:
    text = " ".join(value for value in [old_text, new_text] if value).lower()
    aspect = region.width / max(1, region.height)
    if profile == "engineering_schematic":
        if re.search(r"\b\d+(?:\.\d+)?\s?(?:v|a|w|ohm|hz|mm|cm|m)\b", text):
            category: Category = "DIMENSION"
        elif any(
            token in text
            for token in ["note", "typ", "verify", "refer", "shield", "ground", "connect"]
        ):
            category = "NOTE"
        elif text and (
            len(text.split()) == 1
            or re.search(r"\b(?:r|c|u|q|d|j|k|tp|vcc|gnd)\s*-?\d+\b", text)
        ):
            category = "LABEL"
        elif aspect >= 4.0 or aspect <= 0.25:
            category = "CONNECTION_LINE"
        elif 0.45 <= aspect <= 2.2 and max(region.width, region.height) >= 18:
            category = "COMPONENT"
        else:
            category = "UNKNOWN"
        trades, impact = classification_details(category, profile)
        return category, trades, impact
    if re.search(r"\b\d+[ '-]?\d*(?:[\"']|mm|cm|m|ft)\b", text):
        category = "DIMENSION"
        trades, impact = classification_details(category, profile)
        return category, trades, impact
    if any(word in text for word in ["room", "office", "lobby", "corridor", "toilet", "bed"]):
        category = "ROOM_LABEL"
        trades, impact = classification_details(category, profile)
        return category, trades, impact
    if text:
        category = "TEXT_NOTE"
        trades, impact = classification_details(category, profile)
        return category, trades, impact
    if aspect >= 4.0 or aspect <= 0.25:
        category = "WALL_LINEWORK"
        trades, impact = classification_details(category, profile)
        return category, trades, impact
    if 0.65 <= aspect <= 1.55 and max(region.width, region.height) >= 30:
        category = "DOOR"
        trades, impact = classification_details(category, profile)
        return category, trades, impact
    if aspect >= 1.8:
        category = "WINDOW"
        trades, impact = classification_details(category, profile)
        return category, trades, impact
    category = "FIXTURE_SYMBOL"
    trades, impact = classification_details(category, profile)
    return category, trades, impact
