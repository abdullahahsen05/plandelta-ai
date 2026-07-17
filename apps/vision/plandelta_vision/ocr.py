from __future__ import annotations

import importlib
import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol, cast

import numpy as np

from plandelta_vision.image_io import ColorImage


class PaddleEngine(Protocol):
    def predict(self, input: ColorImage) -> object: ...


@dataclass(frozen=True)
class OcrEvidence:
    text: str | None
    confidence: float | None


@lru_cache(maxsize=4)
def _engine(language: str) -> PaddleEngine:
    if language != "en":
        raise ValueError("The configured PaddleOCR model supports English only.")
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    module = importlib.import_module("paddleocr")
    engine_class = module.PaddleOCR
    engine = engine_class(
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="en_PP-OCRv5_mobile_rec",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        enable_mkldnn=False,
    )
    return cast(PaddleEngine, engine)


def _result_payload(result: object) -> dict[str, object]:
    value = getattr(result, "json", {})
    if callable(value):
        value = value()
    if not isinstance(value, dict):
        return {}
    payload = cast(dict[str, object], value)
    nested = payload.get("res")
    return cast(dict[str, object], nested) if isinstance(nested, dict) else payload


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_crop_text(image: ColorImage, language: str) -> OcrEvidence:
    if image.size == 0 or image.shape[0] < 8 or image.shape[1] < 8:
        return OcrEvidence(text=None, confidence=None)
    predictions = _engine(language).predict(image)
    if not isinstance(predictions, list):
        predictions = list(cast(Iterable[object], predictions))
    texts: list[str] = []
    scores: list[float] = []
    for result in cast(list[object], predictions):
        payload = _result_payload(result)
        raw_texts = payload.get("rec_texts", [])
        raw_scores = payload.get("rec_scores", [])
        if isinstance(raw_texts, list):
            texts.extend(
                _normalize(value) for value in raw_texts if isinstance(value, str) and value.strip()
            )
        if isinstance(raw_scores, (list, np.ndarray)):
            scores.extend(
                float(value) for value in raw_scores if isinstance(value, (int, float, np.floating))
            )
    if not texts:
        return OcrEvidence(text=None, confidence=None)
    confidence = sum(scores) / len(scores) if scores else 0.0
    return OcrEvidence(text=" ".join(texts), confidence=round(confidence, 4))
