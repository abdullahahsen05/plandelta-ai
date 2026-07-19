from __future__ import annotations

import importlib.util
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

from plandelta_agent import __version__
from plandelta_agent.auth import require_internal_token
from plandelta_agent.graph import GraphExecutionResult
from plandelta_agent.ingestion import SafeIngestionError
from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.health import HealthResponse, ReadinessResponse
from plandelta_agent.models.requests import (
    ExecuteAgentRunRequest,
    ExecuteIngestionJobRequest,
    IngestionExecutionResponse,
)
from plandelta_agent.runtime import (
    AgentRuntimeUnavailableError,
    IngestionRuntime,
    get_runtime,
)
from plandelta_agent.telemetry import request_telemetry_middleware

app = FastAPI(
    title="PlanDelta Agent",
    description="Internal bounded evidence orchestration service.",
    version=__version__,
    docs_url=None,
    redoc_url=None,
)
app.middleware("http")(request_telemetry_middleware)


class AgentRunExecutionResponse(ContractModel):
    run_id: UUID
    status: str
    result: GraphExecutionResult


@app.exception_handler(SafeIngestionError)
async def ingestion_error_handler(
    _request: Request,
    error: SafeIngestionError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        if error.retryable
        else status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": {
                "code": error.code,
                "message": "The supporting document could not be processed safely.",
                "retryable": error.retryable,
            }
        },
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


@app.post(
    "/internal/v1/ingestion-jobs/{job_id}/execute",
    response_model=IngestionExecutionResponse,
    dependencies=[Depends(require_internal_token)],
)
async def execute_ingestion(
    job_id: UUID,
    request: ExecuteIngestionJobRequest,
    runtime: Annotated[IngestionRuntime, Depends(get_runtime)],
) -> IngestionExecutionResponse:
    if request.job_id != job_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "INGESTION_JOB_ID_MISMATCH",
                "message": "The ingestion job identifiers do not match.",
            },
        )
    try:
        await runtime.execute_ingestion(job_id, request.correlation_id)
    except AgentRuntimeUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "AGENT_RUNTIME_UNAVAILABLE",
                "message": "The agent runtime is not configured.",
            },
        ) from error
    return IngestionExecutionResponse(job_id=job_id, status="completed")


@app.post(
    "/internal/v1/agent-runs/{run_id}/execute",
    response_model=AgentRunExecutionResponse,
    dependencies=[Depends(require_internal_token)],
)
async def execute_agent_run(
    run_id: UUID,
    request: ExecuteAgentRunRequest,
    runtime: Annotated[IngestionRuntime, Depends(get_runtime)],
) -> AgentRunExecutionResponse:
    if request.run_id != run_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "AGENT_RUN_ID_MISMATCH",
                "message": "The agent run identifiers do not match.",
            },
        )
    try:
        result = await runtime.execute_agent_run(run_id, request.correlation_id)
    except AgentRuntimeUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": str(error),
                "message": "The agent run is not ready for execution.",
            },
        ) from error
    return AgentRunExecutionResponse(run_id=run_id, status="completed", result=result)
