import shutil
from pathlib import Path
from typing import cast

import cv2
import pytest

from plandelta_vision.config import VisionSettings
from plandelta_vision.image_io import ColorImage
from plandelta_vision.models import AnalysisRequest
from plandelta_vision.ocr import extract_crop_text
from plandelta_vision.pipeline import analyze

FIXTURES = Path(__file__).resolve().parents[2] / ".." / "samples" / "vision"


def test_paddleocr_reads_real_blueprint_crop(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    image = cast(ColorImage, cv2.imread(str(FIXTURES / "baseline.png")))
    crop = cast(ColorImage, image[190:250, 120:330])

    result = extract_crop_text(crop, "en")

    assert result.text == "OFFICE 101"
    assert result.confidence is not None
    assert result.confidence >= 0.8


def test_pipeline_compares_old_and_new_crop_text(tmp_path: Path) -> None:
    shutil.copy2(FIXTURES / "baseline.png", tmp_path / "baseline.png")
    shutil.copy2(FIXTURES / "text-change.png", tmp_path / "candidate.png")
    request = AnalysisRequest.model_validate(
        {
            "analysisId": "00000000-0000-4000-8000-000000000077",
            "correlationId": "ocr-text-change",
            "baseline": {"kind": "local", "path": "baseline.png"},
            "candidate": {"kind": "local", "path": "candidate.png"},
            "selectedPage": 1,
            "configuration": {"ocrEnabled": True, "classifier": "rules"},
            "artifactOutput": {"kind": "local", "prefix": "analysis/ocr"},
        }
    )
    result = analyze(
        request,
        VisionSettings(
            shared_root=tmp_path,
            temporary_directory=tmp_path / "tmp",
            engine_version="ocr-golden",
            ocr_enabled=True,
        ),
    )

    assert len(result.changes) == 1
    assert result.changes[0].change_type == "TEXT_CHANGED"
    assert result.changes[0].old_text == "OFFICE 101"
    assert result.changes[0].new_text == "OFFICE 107"
    assert result.changes[0].source == "HYBRID"
