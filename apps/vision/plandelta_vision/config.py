from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field


def _platform_path(value: str) -> Path:
    configured = Path(value)
    if os.name == "nt" and value.startswith("/"):
        repository_root = Path(__file__).resolve().parents[3]
        configured = repository_root / value.lstrip("/")
    return configured.resolve()


class VisionSettings(BaseModel):
    """Validated settings for deterministic, bounded blueprint processing."""

    port: int = Field(default=8000, gt=0, le=65535)
    shared_root: Path
    temporary_directory: Path
    schema_version: str = "1.0"
    engine_version: str = "dev"
    internal_service_secret: str = ""
    max_upload_bytes: int = Field(default=20 * 1024 * 1024, gt=0, le=50 * 1024 * 1024)
    max_pdf_pages: int = Field(default=50, gt=0, le=200)
    max_image_pixels: int = Field(default=60_000_000, gt=0, le=120_000_000)
    render_dpi: int = Field(default=180, ge=96, le=300)
    ocr_enabled: bool = True
    ocr_language: str = "en"
    max_ocr_regions: int = Field(default=4, ge=0, le=20)
    onnx_classifier_enabled: bool = True
    onnx_model_path: Path = (
        Path(__file__).resolve().parents[1] / "models" / "changed-region-classifier.onnx"
    )
    onnx_confidence_threshold: float = Field(default=0.78, ge=0.5, le=0.99)
    signed_url_timeout_seconds: int = Field(default=20, ge=2, le=60)


@lru_cache(maxsize=1)
def load_settings() -> VisionSettings:
    return VisionSettings(
        port=int(os.getenv("VISION_PORT", "8000")),
        shared_root=_platform_path(os.getenv("VISION_SHARED_ROOT", "data")),
        temporary_directory=_platform_path(os.getenv("TEMP_DIRECTORY", "tmp/plandelta")),
        schema_version=os.getenv("VISION_SCHEMA_VERSION", "1.0"),
        engine_version=os.getenv("VISION_ENGINE_VERSION", "dev"),
        internal_service_secret=os.getenv("INTERNAL_SERVICE_SECRET", ""),
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024))),
        max_pdf_pages=int(os.getenv("MAX_PDF_PAGES", "50")),
        max_image_pixels=int(os.getenv("MAX_IMAGE_PIXELS", "60000000")),
        render_dpi=int(os.getenv("VISION_RENDER_DPI", "180")),
        ocr_enabled=os.getenv("OCR_ENABLED", "true").lower() == "true",
        ocr_language=os.getenv("OCR_LANGUAGE", "en"),
        max_ocr_regions=int(os.getenv("VISION_MAX_OCR_REGIONS", "4")),
        onnx_classifier_enabled=os.getenv("ONNX_CLASSIFIER_ENABLED", "true").lower() == "true",
        onnx_model_path=_platform_path(
            os.getenv(
                "ONNX_MODEL_PATH",
                str(
                    Path(__file__).resolve().parents[1]
                    / "models"
                    / "changed-region-classifier.onnx"
                ),
            )
        ),
        onnx_confidence_threshold=float(os.getenv("ONNX_CONFIDENCE_THRESHOLD", "0.78")),
        signed_url_timeout_seconds=int(os.getenv("SIGNED_URL_TIMEOUT_SECONDS", "20")),
    )
