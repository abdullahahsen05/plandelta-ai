from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "samples" / "vision"
WIDTH = 800
HEIGHT = 600


def base_sheet() -> np.ndarray:
    image = np.full((HEIGHT, WIDTH, 3), 255, dtype=np.uint8)
    ink = (25, 25, 25)
    cv2.rectangle(image, (24, 24), (775, 575), ink, 2)
    cv2.rectangle(image, (70, 75), (730, 500), ink, 4)
    cv2.line(image, (70, 285), (730, 285), ink, 4)
    cv2.line(image, (390, 75), (390, 500), ink, 4)
    cv2.line(image, (245, 285), (245, 500), ink, 3)
    cv2.line(image, (570, 285), (570, 500), ink, 3)
    cv2.rectangle(image, (105, 118), (165, 175), ink, 2)
    cv2.rectangle(image, (610, 112), (685, 180), ink, 2)
    cv2.circle(image, (145, 405), 25, ink, 2)
    cv2.circle(image, (655, 400), 24, ink, 2)
    cv2.line(image, (390, 205), (430, 205), (255, 255, 255), 7)
    cv2.line(image, (390, 205), (430, 245), ink, 2)
    cv2.ellipse(image, (390, 205), (40, 40), 0, 0, 90, ink, 2)
    cv2.line(image, (245, 385), (285, 385), (255, 255, 255), 7)
    cv2.line(image, (245, 385), (285, 425), ink, 2)
    cv2.ellipse(image, (245, 385), (40, 40), 0, 0, 90, ink, 2)
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(image, "OFFICE 101", (135, 230), font, 0.75, ink, 2, cv2.LINE_AA)
    cv2.putText(image, "MEETING 102", (485, 230), font, 0.75, ink, 2, cv2.LINE_AA)
    cv2.putText(image, "LOBBY 100", (325, 555), font, 0.65, ink, 2, cv2.LINE_AA)
    cv2.putText(image, "12'-0\"", (330, 55), font, 0.55, ink, 1, cv2.LINE_AA)
    for x in range(95, 730, 80):
        cv2.circle(image, (x, 525), 3, ink, -1)
    return image


def write_png(name: str, image: np.ndarray) -> None:
    if not cv2.imwrite(str(OUTPUT / name), image):
        raise RuntimeError(f"Could not write {name}")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    baseline = base_sheet()
    write_png("baseline.png", baseline)
    write_png("unchanged.png", baseline.copy())

    translation = np.float32([[1, 0, 8], [0, 1, -6]])
    translated = cv2.warpAffine(
        baseline,
        translation,
        (WIDTH, HEIGHT),
        flags=cv2.INTER_LINEAR,
        borderValue=(255, 255, 255),
    )
    write_png("translated.png", translated)

    center = (WIDTH / 2, HEIGHT / 2)
    rotation = cv2.getRotationMatrix2D(center, 1.4, 1.0)
    rotated = cv2.warpAffine(
        baseline,
        rotation,
        (WIDTH, HEIGHT),
        flags=cv2.INTER_LINEAR,
        borderValue=(255, 255, 255),
    )
    write_png("rotated.png", rotated)

    added_wall = baseline.copy()
    cv2.line(added_wall, (515, 300), (515, 485), (25, 25, 25), 5)
    write_png("added-wall.png", added_wall)

    removed_door = baseline.copy()
    cv2.rectangle(removed_door, (235, 375), (292, 435), (255, 255, 255), -1)
    cv2.line(removed_door, (245, 375), (245, 445), (25, 25, 25), 3)
    write_png("removed-door.png", removed_door)

    text_change = baseline.copy()
    cv2.rectangle(text_change, (125, 204), (315, 245), (255, 255, 255), -1)
    cv2.putText(
        text_change,
        "OFFICE 107",
        (135, 230),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (25, 25, 25),
        2,
        cv2.LINE_AA,
    )
    write_png("text-change.png", text_change)

    annotated = baseline.copy()
    points = np.array(
        [
            [470, 310],
            [500, 295],
            [535, 305],
            [550, 335],
            [540, 365],
            [505, 375],
            [475, 355],
        ],
        dtype=np.int32,
    )
    cv2.polylines(annotated, [points], True, (25, 25, 25), 2, cv2.LINE_AA)
    write_png("annotated.png", annotated)

    unrelated = np.full_like(baseline, 255)
    cv2.rectangle(unrelated, (35, 35), (765, 565), (25, 25, 25), 2)
    for y in range(80, 540, 55):
        cv2.line(unrelated, (65, y), (735, y), (25, 25, 25), 2)
    cv2.putText(
        unrelated,
        "ELECTRICAL RISER DIAGRAM",
        (180, 300),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (25, 25, 25),
        2,
        cv2.LINE_AA,
    )
    write_png("unrelated.png", unrelated)
    (OUTPUT / "malformed.bin").write_bytes(b"not-a-blueprint")

    baseline_bytes = (OUTPUT / "baseline.png").read_bytes()
    document = pymupdf.open()
    for label in ["COVER PAGE", "SELECTED PLAN PAGE"]:
        page = document.new_page(width=WIDTH, height=HEIGHT)
        page.insert_text((60, 55), label, fontsize=18)
        page.insert_image(
            pymupdf.Rect(0, 0, WIDTH, HEIGHT), stream=baseline_bytes, overlay=False
        )
    document.save(OUTPUT / "two-page.pdf")
    document.close()

    expected = """{
  "added-wall": {
    "box": [0.62, 0.47, 0.07, 0.37],
    "type": "ADDED"
  },
  "removed-door": {
    "box": [0.28, 0.6, 0.1, 0.15],
    "type": "REMOVED"
  },
  "text-change": {
    "box": [0.31, 0.34, 0.04, 0.06],
    "type": "MODIFIED"
  }
}
"""
    with (OUTPUT / "expected.json").open("w", encoding="utf-8", newline="\n") as expected_file:
        expected_file.write(expected)


if __name__ == "__main__":
    main()
