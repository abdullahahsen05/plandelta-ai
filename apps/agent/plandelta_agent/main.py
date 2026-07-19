from __future__ import annotations

import importlib.util

from fastapi import FastAPI

from plandelta_agent import __version__
from plandelta_agent.models.health import HealthResponse, ReadinessResponse

app = FastAPI(
    title="PlanDelta Agent",
    description="Internal bounded evidence orchestration service.",
    version=__version__,
    docs_url=None,
    redoc_url=None,
)


@app.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse(version=__version__)


@app.get("/health/ready", response_model=ReadinessResponse)
def ready() -> ReadinessResponse:
    return ReadinessResponse(
        version=__version__,
        graph_runtime_ready=importlib.util.find_spec("langgraph") is not None,
        local_embeddings_configured=True,
    )
