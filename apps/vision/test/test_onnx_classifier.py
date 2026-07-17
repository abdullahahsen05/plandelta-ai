from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from plandelta_vision.differ import PixelRegion
from plandelta_vision.onnx_classifier import classify_change, read_model_metadata

MODEL_PATH = (
    Path(__file__).resolve().parents[1] / "models" / "changed-region-classifier.onnx"
)


def crops() -> tuple[np.ndarray, np.ndarray]:
    baseline = np.zeros((64, 64, 3), dtype=np.uint8)
    candidate = baseline.copy()
    cv2.line(candidate, (5, 32), (58, 32), (255, 255, 255), 3, cv2.LINE_AA)
    return baseline, candidate


def test_committed_onnx_model_classifies_changed_linework() -> None:
    baseline, candidate = crops()
    metadata = read_model_metadata(MODEL_PATH)
    assert metadata is not None
    assert metadata.selected_by_default is True

    decision = classify_change(
        PixelRegion(4, 28, 56, 7, "ADDED", 0.9),
        None,
        None,
        baseline,
        candidate,
        "onnx",
        True,
        MODEL_PATH,
        0.5,
    )

    assert decision.source == "ONNX"
    assert decision.category == "WALL_LINEWORK"
    assert decision.classifier_confidence is not None
    assert decision.classifier_confidence >= 0.5
    assert decision.model_version == "changed-region-cnn-v1"
    assert decision.warning is None


def test_missing_onnx_model_falls_back_transparently() -> None:
    baseline, candidate = crops()
    decision = classify_change(
        PixelRegion(4, 28, 56, 7, "ADDED", 0.9),
        None,
        None,
        baseline,
        candidate,
        "onnx",
        True,
        MODEL_PATH.with_name("missing.onnx"),
        0.78,
    )

    assert decision.source == "RULES"
    assert decision.category == "WALL_LINEWORK"
    assert decision.warning is not None
    assert "deterministic rules retained" in decision.warning


def test_feature_flag_disables_explicit_onnx_request() -> None:
    baseline, candidate = crops()
    decision = classify_change(
        PixelRegion(4, 28, 56, 7, "ADDED", 0.9),
        None,
        None,
        baseline,
        candidate,
        "onnx",
        False,
        MODEL_PATH,
        0.78,
    )

    assert decision.source == "RULES"
    assert decision.warning == "ONNX classifier is disabled; deterministic rules retained."
