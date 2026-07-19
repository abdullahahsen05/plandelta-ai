from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(alias_generator=lambda value: value, populate_by_name=True)

    service: Literal["agent"] = "agent"
    status: Literal["ok"] = "ok"
    version: str


class ReadinessResponse(HealthResponse):
    graph_runtime_ready: bool
    local_embeddings_configured: bool
