from __future__ import annotations

import os
from functools import lru_cache

from pydantic import BaseModel, Field, SecretStr, model_validator


class AgentSettings(BaseModel):
    internal_token: SecretStr = Field(min_length=32)
    chat_provider: str = Field(pattern=r"^(bedrock|fake)$")
    embedding_provider: str = Field(pattern=r"^local$")
    embedding_model: str = Field(min_length=1, max_length=200)
    embedding_dimension: int = Field(ge=64, le=2048)
    max_model_turns: int = Field(ge=1, le=8)
    max_tool_calls: int = Field(ge=1, le=12)
    max_retrieved_chunks: int = Field(ge=1, le=12)
    max_repair_passes: int = Field(ge=0, le=1)
    run_timeout_seconds: int = Field(ge=5, le=120)
    max_estimated_cost_usd: float = Field(gt=0, le=0.05)
    worker_concurrency: int = Field(ge=1, le=1)
    trace_content_enabled: bool = False
    bedrock_model_id: str | None = None
    bedrock_region: str = "us-east-1"

    @model_validator(mode="after")
    def provider_configuration_is_complete(self) -> AgentSettings:
        if self.chat_provider == "bedrock" and not self.bedrock_model_id:
            raise ValueError("BEDROCK_MODEL_ID is required when AGENT_CHAT_PROVIDER=bedrock.")
        if self.trace_content_enabled:
            raise ValueError("AGENT_TRACE_CONTENT_ENABLED must remain false.")
        return self


@lru_cache(maxsize=1)
def load_settings() -> AgentSettings:
    return AgentSettings(
        internal_token=SecretStr(os.getenv("AGENT_INTERNAL_TOKEN", "")),
        chat_provider=os.getenv("AGENT_CHAT_PROVIDER", "fake"),
        embedding_provider=os.getenv("AGENT_EMBEDDING_PROVIDER", "local"),
        embedding_model=os.getenv("AGENT_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"),
        embedding_dimension=int(os.getenv("AGENT_EMBEDDING_DIMENSION", "384")),
        max_model_turns=int(os.getenv("AGENT_MAX_MODEL_TURNS", "8")),
        max_tool_calls=int(os.getenv("AGENT_MAX_TOOL_CALLS", "12")),
        max_retrieved_chunks=int(os.getenv("AGENT_MAX_RETRIEVED_CHUNKS", "12")),
        max_repair_passes=int(os.getenv("AGENT_MAX_REPAIR_PASSES", "1")),
        run_timeout_seconds=int(os.getenv("AGENT_RUN_TIMEOUT_SECONDS", "60")),
        max_estimated_cost_usd=float(os.getenv("AGENT_MAX_ESTIMATED_COST_USD", "0.02")),
        worker_concurrency=int(os.getenv("AGENT_WORKER_CONCURRENCY", "1")),
        trace_content_enabled=os.getenv("AGENT_TRACE_CONTENT_ENABLED", "false").lower() == "true",
        bedrock_model_id=os.getenv("BEDROCK_MODEL_ID") or None,
        bedrock_region=os.getenv("BEDROCK_REGION", "us-east-1"),
    )
