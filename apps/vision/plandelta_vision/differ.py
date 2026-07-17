from __future__ import annotations

from dataclasses import dataclass
from typing import cast

import cv2
import numpy as np

from plandelta_vision.image_io import GrayImage


@dataclass(frozen=True)
class PixelRegion:
    x: int
    y: int
    width: int
    height: int
    change_type: str
    confidence: float


@dataclass(frozen=True)
class DifferenceResult:
    added_mask: GrayImage
    removed_mask: GrayImage
    changed_mask: GrayImage
    regions: list[PixelRegion]
    changed_area_ratio: float
    added_area_ratio: float
    removed_area_ratio: float


def _thresholds(sensitivity: str, area: int) -> tuple[int, int]:
    if sensitivity == "conservative":
        return 52, max(48, int(area * 0.00012))
    if sensitivity == "sensitive":
        return 24, max(14, int(area * 0.000025))
    return 36, max(24, int(area * 0.00006))


def calculate_differences(
    baseline_gray: GrayImage,
    candidate_gray: GrayImage,
    valid_mask: GrayImage,
    sensitivity: str,
) -> DifferenceResult:
    area = baseline_gray.shape[0] * baseline_gray.shape[1]
    threshold, minimum_area = _thresholds(sensitivity, area)
    baseline_blur = cv2.GaussianBlur(baseline_gray, (3, 3), 0)
    candidate_blur = cv2.GaussianBlur(candidate_gray, (3, 3), 0)
    baseline_ink = cv2.subtract(np.full_like(baseline_gray, 255), baseline_blur)
    candidate_ink = cv2.subtract(np.full_like(candidate_gray, 255), candidate_blur)
    added_delta = cv2.subtract(candidate_ink, baseline_ink)
    removed_delta = cv2.subtract(baseline_ink, candidate_ink)
    _, added = cv2.threshold(added_delta, threshold, 255, cv2.THRESH_BINARY)
    _, removed = cv2.threshold(removed_delta, threshold, 255, cv2.THRESH_BINARY)

    valid = cv2.erode(valid_mask, np.ones((5, 5), dtype=np.uint8), iterations=1)
    added = cv2.bitwise_and(added, valid)
    removed = cv2.bitwise_and(removed, valid)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    added = cv2.morphologyEx(added, cv2.MORPH_CLOSE, close_kernel, iterations=1)
    removed = cv2.morphologyEx(removed, cv2.MORPH_CLOSE, close_kernel, iterations=1)
    combined = cv2.bitwise_or(added, removed)
    region_mask = cv2.dilate(combined, np.ones((5, 5), dtype=np.uint8), iterations=1)

    component_count, labels, statistics, _ = cv2.connectedComponentsWithStats(
        region_mask, connectivity=8
    )
    height, width = baseline_gray.shape
    regions: list[PixelRegion] = []
    for label in range(1, component_count):
        x, y, box_width, box_height, component_area = statistics[label]
        if int(component_area) < minimum_area:
            continue
        padding = 5
        x0 = max(0, int(x) - padding)
        y0 = max(0, int(y) - padding)
        x1 = min(width, int(x + box_width) + padding)
        y1 = min(height, int(y + box_height) + padding)
        component = labels[y0:y1, x0:x1] == label
        added_count = int(np.count_nonzero((added[y0:y1, x0:x1] > 0) & component))
        removed_count = int(np.count_nonzero((removed[y0:y1, x0:x1] > 0) & component))
        directional_total = added_count + removed_count
        if directional_total < minimum_area:
            continue
        if added_count > removed_count * 1.8:
            change_type = "ADDED"
        elif removed_count > added_count * 1.8:
            change_type = "REMOVED"
        else:
            change_type = "MODIFIED"
        density = min(1.0, directional_total / max(1, (x1 - x0) * (y1 - y0)))
        confidence = min(0.99, 0.58 + density * 0.75)
        regions.append(
            PixelRegion(
                x=x0,
                y=y0,
                width=x1 - x0,
                height=y1 - y0,
                change_type=change_type,
                confidence=round(confidence, 4),
            )
        )

    regions.sort(key=lambda region: (region.y, region.x, region.width, region.height))
    pixel_count = max(1, int(np.count_nonzero(valid)))
    return DifferenceResult(
        added_mask=cast(GrayImage, added),
        removed_mask=cast(GrayImage, removed),
        changed_mask=cast(GrayImage, combined),
        regions=regions,
        changed_area_ratio=round(float(np.count_nonzero(combined)) / pixel_count, 6),
        added_area_ratio=round(float(np.count_nonzero(added)) / pixel_count, 6),
        removed_area_ratio=round(float(np.count_nonzero(removed)) / pixel_count, 6),
    )
