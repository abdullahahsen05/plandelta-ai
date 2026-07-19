from __future__ import annotations

from typing import Literal

from plandelta_agent.models.base import ContractModel


class HealthResponse(ContractModel):
    service: Literal["agent"] = "agent"
    status: Literal["ok"] = "ok"
    version: str


class ReadinessResponse(HealthResponse):
    graph_runtime_ready: bool
    local_embeddings_configured: bool
    live_chat_ready: bool
    chat_provider: Literal["bedrock", "fake"]
