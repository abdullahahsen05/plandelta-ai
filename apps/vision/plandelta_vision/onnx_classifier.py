from __future__ import annotations

import hashlib
import importlib
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal, Protocol, cast

import cv2
import numpy as np

from plandelta_vision.classify import (
    AnalysisProfile,
    Category,
    classification_details,
    classify_region,
)
from plandelta_vision.differ import PixelRegion
from plandelta_vision.image_io import ColorImage


@dataclass(frozen=True)
class ClassificationDecision:
    category: Category
    trades: list[str]
    impact: str
    source: Literal["RULES", "ONNX"]
    classifier_confidence: float | None = None
    model_version: str | None = None
    warning: str | None = None


@dataclass(frozen=True)
class ModelMetadata:
    version: str
    labels: tuple[Category, ...]
    input_size: int
    selected_by_default: bool
    model_sha256: str


class RuntimeInput(Protocol):
    name: str


class RuntimeSession(Protocol):
    def get_inputs(self) -> list[RuntimeInput]: ...

    def run(
        self,
        output_names: None,
        input_feed: dict[str, np.ndarray[tuple[int, ...], np.dtype[np.float32]]],
    ) -> list[object]: ...


@dataclass(frozen=True)
class ModelBundle:
    session: RuntimeSession
    input_name: str
    metadata: ModelMetadata


def _metadata_path(model_path: Path) -> Path:
    return model_path.with_suffix(".json")


def read_model_metadata(model_path: Path) -> ModelMetadata | None:
    metadata_path = _metadata_path(model_path)
    if not model_path.is_file() or not metadata_path.is_file():
        return None
    try:
        payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        labels = tuple(cast(list[Category], payload["labels"]))
        if len(labels) != 8 or len(set(labels)) != len(labels):
            return None
        expected_sha256 = str(payload["modelSha256"])
        if hashlib.sha256(model_path.read_bytes()).hexdigest() != expected_sha256:
            return None
        return ModelMetadata(
            version=str(payload["modelVersion"]),
            labels=labels,
            input_size=int(payload["inputSize"]),
            selected_by_default=bool(payload["selectedByDefault"]),
            model_sha256=expected_sha256,
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, OSError):
        return None


@lru_cache(maxsize=4)
def _load_bundle(model_path_value: str) -> ModelBundle:
    model_path = Path(model_path_value)
    metadata = read_model_metadata(model_path)
    if metadata is None:
        raise RuntimeError("ONNX classifier model or metadata is unavailable.")
    runtime = importlib.import_module("onnxruntime")
    session = cast(
        RuntimeSession,
        runtime.InferenceSession(
            str(model_path),
            providers=["CPUExecutionProvider"],
        ),
    )
    input_name = str(session.get_inputs()[0].name)
    return ModelBundle(session=session, input_name=input_name, metadata=metadata)


def _model_input(
    baseline_crop: ColorImage,
    candidate_crop: ColorImage,
    input_size: int,
) -> np.ndarray[tuple[int, ...], np.dtype[np.float32]]:
    baseline_gray = cv2.cvtColor(baseline_crop, cv2.COLOR_BGR2GRAY)
    candidate_gray = cv2.cvtColor(candidate_crop, cv2.COLOR_BGR2GRAY)
    difference = cv2.absdiff(baseline_gray, candidate_gray)
    resized = cv2.resize(difference, (input_size, input_size), interpolation=cv2.INTER_AREA)
    normalized = resized.astype(np.float32) / 255.0
    return normalized[np.newaxis, np.newaxis, :, :]


def _softmax(
    logits: np.ndarray[tuple[int, ...], np.dtype[np.float32]],
) -> np.ndarray[tuple[int, ...], np.dtype[np.float32]]:
    shifted = logits - np.max(logits)
    exponentials = np.exp(shifted)
    return exponentials / np.sum(exponentials)


def classify_change(
    region: PixelRegion,
    old_text: str | None,
    new_text: str | None,
    baseline_crop: ColorImage,
    candidate_crop: ColorImage,
    requested: Literal["auto", "rules", "onnx"],
    enabled: bool,
    model_path: Path,
    confidence_threshold: float,
    profile: AnalysisProfile = "construction_drawing",
) -> ClassificationDecision:
    rules_category, rules_trades, rules_impact = classify_region(
        region, old_text, new_text, profile
    )
    if profile == "engineering_schematic":
        return ClassificationDecision(
            rules_category,
            rules_trades,
            rules_impact,
            "RULES",
        )
    if requested == "rules":
        return ClassificationDecision(rules_category, rules_trades, rules_impact, "RULES")
    if not enabled:
        return ClassificationDecision(
            rules_category,
            rules_trades,
            rules_impact,
            "RULES",
            warning=(
                "ONNX classifier is disabled; deterministic rules retained."
                if requested == "onnx"
                else None
            ),
        )

    metadata = read_model_metadata(model_path)
    if metadata is None or (requested == "auto" and not metadata.selected_by_default):
        return ClassificationDecision(
            rules_category,
            rules_trades,
            rules_impact,
            "RULES",
            warning="ONNX classifier unavailable or not selected; deterministic rules retained.",
        )

    try:
        bundle = _load_bundle(str(model_path.resolve()))
        model_input = _model_input(
            baseline_crop,
            candidate_crop,
            bundle.metadata.input_size,
        )
        outputs = bundle.session.run(None, {bundle.input_name: model_input})
        logits = np.asarray(outputs[0], dtype=np.float32)[0]
        probabilities = _softmax(logits)
        index = int(np.argmax(probabilities))
        confidence = round(float(probabilities[index]), 4)
        category = bundle.metadata.labels[index]
        if confidence < confidence_threshold:
            return ClassificationDecision(
                rules_category,
                rules_trades,
                rules_impact,
                "RULES",
                classifier_confidence=confidence,
                model_version=bundle.metadata.version,
                warning=(
                    "ONNX classifier confidence was below the configured threshold; "
                    "deterministic rules retained."
                ),
            )
        trades, impact = classification_details(category, profile)
        return ClassificationDecision(
            category,
            trades,
            impact,
            "ONNX",
            classifier_confidence=confidence,
            model_version=bundle.metadata.version,
        )
    except Exception:
        return ClassificationDecision(
            rules_category,
            rules_trades,
            rules_impact,
            "RULES",
            model_version=metadata.version,
            warning="ONNX inference failed; deterministic rules retained.",
        )
