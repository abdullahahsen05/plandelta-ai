from __future__ import annotations

import importlib.util
import re
from importlib.metadata import version

import cv2
import pymupdf
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from plandelta_vision import __version__
from plandelta_vision.config import load_settings
from plandelta_vision.errors import VisionError
from plandelta_vision.models import (
    AnalysisRequest,
    AnalysisResponse,
    EngineResponse,
    ErrorBody,
    ErrorResponse,
    HealthResponse,
    ReadinessResponse,
)
from plandelta_vision.onnx_classifier import read_model_metadata
from plandelta_vision.pipeline import analyze
from plandelta_vision.security import require_internal_secret

app = FastAPI(
    title="PlanDelta Vision",
    description="Internal stateless blueprint comparison service.",
    version=__version__,
    docs_url=None,
    redoc_url=None,
)


def _correlation_id(request: Request) -> str:
    supplied = request.headers.get("x-correlation-id", "")
    return supplied if re.fullmatch(r"[A-Za-z0-9._:-]{1,100}", supplied) else "missing"


@app.exception_handler(VisionError)
async def vision_error_handler(request: Request, error: VisionError) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorBody(
            code=error.code,
            message=error.message,
            correlation_id=_correlation_id(request),
        )
    )
    return JSONResponse(status_code=error.status_code, content=body.model_dump(by_alias=True))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, _error: RequestValidationError
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorBody(
            code="REQUEST_VALIDATION_FAILED",
            message="The vision request did not match the service contract.",
            correlation_id=_correlation_id(request),
        )
    )
    return JSONResponse(status_code=422, content=body.model_dump(by_alias=True))


@app.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse(service="vision", status="ok", version=__version__)


@app.get("/health/ready", response_model=ReadinessResponse)
def ready() -> ReadinessResponse:
    settings = load_settings()
    model_metadata = read_model_metadata(settings.onnx_model_path)
    settings.temporary_directory.mkdir(parents=True, exist_ok=True)
    settings.shared_root.mkdir(parents=True, exist_ok=True)
    probe = settings.temporary_directory / ".readiness-probe"
    try:
        probe.write_bytes(b"ready")
        probe.unlink()
    except OSError as error:
        raise VisionError(
            "TEMPORARY_DIRECTORY_UNAVAILABLE",
            "The temporary processing directory is not writable.",
            503,
        ) from error
    return ReadinessResponse(
        service="vision",
        status="ok",
        version=__version__,
        writable_temporary_directory=True,
        opencv_ready=True,
        pdf_renderer_ready=True,
        ocr_runtime_ready=importlib.util.find_spec("paddleocr") is not None,
        onnx_runtime_ready=(
            not settings.onnx_classifier_enabled
            or (
                importlib.util.find_spec("onnxruntime") is not None
                and model_metadata is not None
                and model_metadata.selected_by_default
            )
        ),
    )


@app.get("/internal/v1/engine", response_model=EngineResponse)
def engine() -> EngineResponse:
    settings = load_settings()
    model_metadata = read_model_metadata(settings.onnx_model_path)
    return EngineResponse(
        schema_version=settings.schema_version,
        engine_version=settings.engine_version,
        opencv_version=cv2.__version__,
        pdf_renderer=f"PyMuPDF {pymupdf.VersionBind}",
        ocr_engine=f"PaddleOCR {version('paddleocr')}",
        onnx_model_version=(
            model_metadata.version
            if settings.onnx_classifier_enabled
            and model_metadata is not None
            and model_metadata.selected_by_default
            else None
        ),
        supported_formats=["application/pdf", "image/png", "image/jpeg"],
    )


@app.post(
    "/internal/v1/analyses",
    response_model=AnalysisResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    dependencies=[Depends(require_internal_secret)],
)
def analyze_revision(request: AnalysisRequest) -> AnalysisResponse:
    return analyze(request, load_settings())
