from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, status

from plandelta_vision import __version__
from plandelta_vision.config import load_settings
from plandelta_vision.models import EngineResponse, HealthResponse, ReadinessResponse

app = FastAPI(
    title="PlanDelta Vision",
    description="Internal stateless blueprint comparison service.",
    version=__version__,
    docs_url=None,
    redoc_url=None,
)


@app.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse(service="vision", status="ok", version=__version__)


@app.get("/health/ready", response_model=ReadinessResponse)
def ready() -> ReadinessResponse:
    temporary_directory = Path(tempfile.gettempdir())
    if not temporary_directory.is_dir() or not temporary_directory.exists():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Temporary processing directory is unavailable.",
        )

    return ReadinessResponse(
        service="vision",
        status="ok",
        version=__version__,
        writable_temporary_directory=True,
    )


@app.get("/internal/v1/engine", response_model=EngineResponse)
def engine() -> EngineResponse:
    settings = load_settings()
    return EngineResponse(
        schema_version=settings.schema_version,
        engine_version=settings.engine_version,
        supported_formats=["application/pdf", "image/png", "image/jpeg"],
    )
