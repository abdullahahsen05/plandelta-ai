from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from plandelta_vision.config import VisionSettings
from plandelta_vision.errors import UnsafeAlignmentError, VisionError
from plandelta_vision.models import AnalysisRequest
from plandelta_vision.pipeline import analyze

FIXTURES = Path(__file__).resolve().parents[2] / ".." / "samples" / "vision"


def settings(root: Path) -> VisionSettings:
    return VisionSettings(
        shared_root=root,
        temporary_directory=root / "tmp",
        engine_version="golden-test",
        internal_service_secret="test-internal-secret-that-is-long-enough",
        ocr_enabled=False,
    )


def request(candidate: str, prefix: str = "artifacts/result") -> AnalysisRequest:
    return AnalysisRequest.model_validate(
        {
            "analysisId": "00000000-0000-4000-8000-000000000099",
            "correlationId": "golden-fixture",
            "baseline": {"kind": "local", "path": "baseline.png"},
            "candidate": {"kind": "local", "path": candidate},
            "selectedPage": 1,
            "configuration": {
                "sensitivity": "balanced",
                "ocrEnabled": False,
                "classifier": "rules",
            },
            "artifactOutput": {"kind": "local", "prefix": prefix},
        }
    )


@pytest.fixture
def fixture_root(tmp_path: Path) -> Path:
    for fixture in FIXTURES.iterdir():
        if fixture.is_file():
            shutil.copy2(fixture, tmp_path / fixture.name)
    return tmp_path


def intersection_over_union(
    actual: tuple[float, float, float, float], expected: list[float]
) -> float:
    ax, ay, aw, ah = actual
    bx, by, bw, bh = expected
    x0 = max(ax, bx)
    y0 = max(ay, by)
    x1 = min(ax + aw, bx + bw)
    y1 = min(ay + ah, by + bh)
    intersection = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    union = aw * ah + bw * bh - intersection
    return intersection / union if union else 0.0


def test_unchanged_pair_has_no_material_false_positive(fixture_root: Path) -> None:
    result = analyze(request("unchanged.png"), settings(fixture_root))

    assert result.alignment.method == "IDENTITY"
    assert result.alignment.confidence == 1
    assert result.metrics.changed_area_ratio <= 0.0001
    assert result.changes == []
    assert {artifact.kind for artifact in result.artifacts} >= {
        "BASELINE_RENDER",
        "ALIGNED_CANDIDATE",
        "OVERLAY",
    }


@pytest.mark.parametrize("candidate", ["translated.png", "rotated.png"])
def test_alignment_removes_small_scan_transform_without_fake_regions(
    fixture_root: Path, candidate: str
) -> None:
    result = analyze(request(candidate, f"artifacts/{candidate}"), settings(fixture_root))

    assert result.alignment.method in {"ORB_HOMOGRAPHY", "ECC_EUCLIDEAN"}
    assert result.alignment.confidence >= 0.5
    assert result.metrics.changed_area_ratio < 0.015
    assert len(result.changes) <= 3


@pytest.mark.parametrize("case", ["added-wall", "removed-door", "text-change"])
def test_golden_change_region_intersects_expected_evidence(fixture_root: Path, case: str) -> None:
    expected = json.loads((fixture_root / "expected.json").read_text(encoding="utf-8"))[case]
    result = analyze(request(f"{case}.png", f"artifacts/{case}"), settings(fixture_root))

    assert result.changes
    boxes = [
        (change.box.x, change.box.y, change.box.width, change.box.height)
        for change in result.changes
    ]
    assert max(intersection_over_union(box, expected["box"]) for box in boxes) >= 0.15
    assert [change.sequence for change in result.changes] == list(range(1, len(result.changes) + 1))
    assert all(0 <= change.box.x <= 1 and 0 < change.box.width <= 1 for change in result.changes)


def test_revision_annotation_produces_real_directional_evidence(fixture_root: Path) -> None:
    result = analyze(request("annotated.png", "artifacts/annotated"), settings(fixture_root))

    assert result.metrics.added_area_ratio > result.metrics.removed_area_ratio
    assert any(change.change_type == "ADDED" for change in result.changes)
    assert any(artifact.kind == "EVIDENCE_CROP" for artifact in result.artifacts)


def test_auto_classifier_uses_selected_onnx_model(fixture_root: Path) -> None:
    analysis_request = request("added-wall.png", "artifacts/onnx")
    analysis_request.configuration.classifier = "auto"
    result = analyze(analysis_request, settings(fixture_root))

    assert any(change.source == "ONNX" for change in result.changes)
    assert any(
        change.evidence.get("classifierVersion") == "changed-region-cnn-v1"
        for change in result.changes
    )
    assert not any("inference failed" in warning for warning in result.warnings)


def test_unrelated_sheets_fail_alignment_instead_of_returning_boxes(fixture_root: Path) -> None:
    with pytest.raises(UnsafeAlignmentError, match="sufficient confidence"):
        analyze(request("unrelated.png", "artifacts/unrelated"), settings(fixture_root))


def test_malformed_input_is_rejected_before_processing(fixture_root: Path) -> None:
    with pytest.raises(VisionError) as caught:
        analyze(request("malformed.bin", "artifacts/malformed"), settings(fixture_root))

    assert caught.value.code == "INPUT_TYPE_UNSUPPORTED"


def test_pdf_page_rendering_and_page_bounds(fixture_root: Path) -> None:
    pdf_request = request("two-page.pdf", "artifacts/pdf")
    pdf_request.baseline.path = "two-page.pdf"
    pdf_request.selected_page = 2
    result = analyze(pdf_request, settings(fixture_root))

    assert result.metrics.baseline_width_px > 0
    assert result.metrics.baseline_height_px > 0
    pdf_request.selected_page = 3
    with pytest.raises(VisionError) as caught:
        analyze(pdf_request, settings(fixture_root))
    assert caught.value.code == "SELECTED_PAGE_INVALID"
