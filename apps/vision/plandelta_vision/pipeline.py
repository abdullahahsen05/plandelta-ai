from __future__ import annotations

import re
from time import perf_counter

import cv2
import numpy as np

from plandelta_vision.alignment import align_candidate
from plandelta_vision.artifacts import ArtifactStore
from plandelta_vision.classify import AnalysisProfile
from plandelta_vision.config import VisionSettings
from plandelta_vision.differ import PixelRegion, calculate_differences
from plandelta_vision.errors import VisionError
from plandelta_vision.image_io import (
    ColorImage,
    decode_drawing,
    normalize_image,
    read_reference,
    resize_to_baseline,
)
from plandelta_vision.models import (
    AnalysisMetrics,
    AnalysisRequest,
    AnalysisResponse,
    DetectedChangeResult,
    NormalizedBox,
    NormalizedPoint,
)
from plandelta_vision.ocr import OcrEvidence, extract_crop_text
from plandelta_vision.onnx_classifier import classify_change


def _crop(image: ColorImage, region: PixelRegion, padding: int = 4) -> ColorImage:
    height, width = image.shape[:2]
    x0 = max(0, region.x - padding)
    y0 = max(0, region.y - padding)
    x1 = min(width, region.x + region.width + padding)
    y1 = min(height, region.y + region.height + padding)
    return image[y0:y1, x0:x1].copy()


def _ocr_context(image: ColorImage, region: PixelRegion) -> ColorImage:
    height, width = image.shape[:2]
    horizontal_padding = min(180, max(40, region.width * 5))
    vertical_padding = min(40, max(12, region.height))
    x0 = max(0, region.x - horizontal_padding)
    y0 = max(0, region.y - vertical_padding)
    x1 = min(width, region.x + region.width + horizontal_padding)
    y1 = min(height, region.y + region.height + vertical_padding)
    return image[y0:y1, x0:x1].copy()


def _normalize_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower()) if value else ""


def _ocr_pair(
    baseline_crop: ColorImage,
    candidate_crop: ColorImage,
    enabled: bool,
    language: str,
) -> tuple[OcrEvidence, OcrEvidence]:
    if not enabled:
        empty = OcrEvidence(text=None, confidence=None)
        return empty, empty
    try:
        return extract_crop_text(baseline_crop, language), extract_crop_text(
            candidate_crop, language
        )
    except Exception as error:
        raise VisionError(
            "OCR_FAILED", "The configured OCR engine could not process a crop.", 503
        ) from error


def _overlay(
    baseline: ColorImage,
    added_mask: np.ndarray[tuple[int, ...], np.dtype[np.uint8]],
    removed_mask: np.ndarray[tuple[int, ...], np.dtype[np.uint8]],
    regions: list[PixelRegion],
) -> ColorImage:
    result = baseline.copy()
    added_color = np.zeros_like(result)
    added_color[:] = (125, 145, 0)
    removed_color = np.zeros_like(result)
    removed_color[:] = (55, 60, 210)
    added_pixels = added_mask > 0
    if np.any(added_pixels):
        result[added_pixels] = (
            result[added_pixels].astype(np.float32) * 0.3
            + added_color[added_pixels].astype(np.float32) * 0.7
        ).astype(np.uint8)
    removed_pixels = removed_mask > 0
    if np.any(removed_pixels):
        result[removed_pixels] = (
            result[removed_pixels].astype(np.float32) * 0.3
            + removed_color[removed_pixels].astype(np.float32) * 0.7
        ).astype(np.uint8)
    for index, region in enumerate(regions, start=1):
        color = (125, 145, 0) if region.change_type == "ADDED" else (55, 60, 210)
        cv2.rectangle(
            result,
            (region.x, region.y),
            (region.x + region.width, region.y + region.height),
            color,
            2,
        )
        cv2.putText(
            result,
            str(index),
            (region.x + 3, max(14, region.y - 4)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            color,
            1,
            cv2.LINE_AA,
        )
    return result


def _evidence_crop(baseline: ColorImage, candidate: ColorImage) -> ColorImage:
    height = max(baseline.shape[0], candidate.shape[0])
    baseline_resized = cv2.copyMakeBorder(
        baseline,
        0,
        height - baseline.shape[0],
        0,
        0,
        cv2.BORDER_CONSTANT,
        value=(255, 255, 255),
    )
    candidate_resized = cv2.copyMakeBorder(
        candidate,
        0,
        height - candidate.shape[0],
        0,
        0,
        cv2.BORDER_CONSTANT,
        value=(255, 255, 255),
    )
    divider = np.full((height, 2, 3), (35, 42, 45), dtype=np.uint8)
    return np.concatenate([baseline_resized, divider, candidate_resized], axis=1)


def _change_result(
    sequence: int,
    region: PixelRegion,
    canvas_width: int,
    canvas_height: int,
    old_ocr: OcrEvidence,
    new_ocr: OcrEvidence,
    evidence_key: str,
    alignment_confidence: float,
    baseline_crop: ColorImage,
    candidate_crop: ColorImage,
    classifier: str,
    settings: VisionSettings,
    request_profile: AnalysisProfile,
) -> tuple[DetectedChangeResult, str | None]:
    text_changed = _normalize_text(old_ocr.text) != _normalize_text(new_ocr.text) and bool(
        old_ocr.text or new_ocr.text
    )
    change_type = "TEXT_CHANGED" if text_changed else region.change_type
    decision = classify_change(
        region,
        old_ocr.text,
        new_ocr.text,
        baseline_crop,
        candidate_crop,
        classifier,  # type: ignore[arg-type]
        settings.onnx_classifier_enabled,
        settings.onnx_model_path,
        settings.onnx_confidence_threshold,
        request_profile,
    )
    text_scores = [value for value in [old_ocr.confidence, new_ocr.confidence] if value is not None]
    text_confidence = round(sum(text_scores) / len(text_scores), 4) if text_scores else None
    source = "HYBRID" if text_changed else decision.source
    x = region.x / canvas_width
    y = region.y / canvas_height
    width = min(1 - x, region.width / canvas_width)
    height = min(1 - y, region.height / canvas_height)
    confidence = round(min(region.confidence, alignment_confidence), 4)
    evidence: dict[str, str | int | float | bool | None] = {
        "artifactStorageKey": evidence_key,
        "method": "crop-pair",
        "classifierSource": decision.source,
    }
    if decision.classifier_confidence is not None:
        evidence["classifierConfidence"] = decision.classifier_confidence
    if decision.model_version is not None:
        evidence["classifierVersion"] = decision.model_version
    result = DetectedChangeResult(
        sequence=sequence,
        change_type=change_type,  # type: ignore[arg-type]
        category=decision.category,
        source=source,  # type: ignore[arg-type]
        box=NormalizedBox(x=x, y=y, width=width, height=height),
        polygon=[
            NormalizedPoint(x=x, y=y),
            NormalizedPoint(x=x + width, y=y),
            NormalizedPoint(x=x + width, y=y + height),
            NormalizedPoint(x=x, y=y + height),
        ],
        confidence=confidence,
        old_text=old_ocr.text,
        new_text=new_ocr.text,
        text_confidence=text_confidence,
        affected_trades=decision.trades,
        impact=decision.impact,
        evidence=evidence,
    )
    return result, decision.warning


def analyze(request: AnalysisRequest, settings: VisionSettings) -> AnalysisResponse:
    started = perf_counter()
    baseline_bytes = read_reference(request.baseline, settings)
    candidate_bytes = read_reference(request.candidate, settings)
    baseline_source = decode_drawing(baseline_bytes, request.selected_page, settings)
    candidate_source = decode_drawing(candidate_bytes, request.selected_page, settings)
    baseline_color, baseline_gray = normalize_image(baseline_source)
    candidate_resized = resize_to_baseline(candidate_source, baseline_source)
    candidate_color, candidate_gray = normalize_image(candidate_resized)
    aligned = align_candidate(baseline_gray, candidate_color, candidate_gray)
    difference = calculate_differences(
        baseline_gray,
        aligned.gray,
        aligned.valid_mask,
        request.configuration.sensitivity,
    )

    store = ArtifactStore(settings.shared_root, request.artifact_output.prefix)
    artifacts = [
        store.write_png("BASELINE_RENDER", "baseline-render.png", baseline_color),
        store.write_png("CANDIDATE_RENDER", "candidate-render.png", candidate_color),
        store.write_png("ALIGNED_CANDIDATE", "candidate-aligned.png", aligned.image),
        store.write_png("ADDED_MASK", "added-mask.png", difference.added_mask),
        store.write_png("REMOVED_MASK", "removed-mask.png", difference.removed_mask),
    ]
    overlay = _overlay(
        baseline_color,
        difference.added_mask,
        difference.removed_mask,
        difference.regions,
    )
    artifacts.append(store.write_png("OVERLAY", "overlay.png", overlay))

    changes: list[DetectedChangeResult] = []
    warnings: list[str] = []
    ocr_enabled = request.configuration.ocr_enabled and settings.ocr_enabled
    for sequence, region in enumerate(difference.regions, start=1):
        baseline_crop = _crop(baseline_color, region)
        candidate_crop = _crop(aligned.image, region)
        evidence_filename = f"evidence-region-{sequence:03d}.png"
        evidence_artifact = store.write_png(
            "EVIDENCE_CROP",
            evidence_filename,
            _evidence_crop(baseline_crop, candidate_crop),
            {"sequence": sequence},
        )
        artifacts.append(evidence_artifact)
        old_ocr, new_ocr = _ocr_pair(
            _ocr_context(baseline_color, region),
            _ocr_context(aligned.image, region),
            ocr_enabled,
            settings.ocr_language,
        )
        change, classifier_warning = _change_result(
            sequence,
            region,
            baseline_gray.shape[1],
            baseline_gray.shape[0],
            old_ocr,
            new_ocr,
            evidence_artifact.storage_key,
            aligned.result.confidence,
            baseline_crop,
            candidate_crop,
            request.configuration.classifier,
            settings,
            request.analysis_profile,
        )
        changes.append(change)
        if classifier_warning:
            warnings.append(f"Region {sequence}: {classifier_warning}")

    if not ocr_enabled:
        warnings.append("Crop OCR was disabled for this analysis.")
    duration_ms = round((perf_counter() - started) * 1000)
    return AnalysisResponse(
        schema_version=settings.schema_version,
        engine_version=settings.engine_version,
        analysis_id=request.analysis_id,
        alignment=aligned.result,
        metrics=AnalysisMetrics(
            duration_ms=duration_ms,
            changed_area_ratio=difference.changed_area_ratio,
            added_area_ratio=difference.added_area_ratio,
            removed_area_ratio=difference.removed_area_ratio,
            region_count=len(changes),
            baseline_width_px=baseline_gray.shape[1],
            baseline_height_px=baseline_gray.shape[0],
        ),
        warnings=warnings,
        artifacts=artifacts,
        changes=changes,
    )
