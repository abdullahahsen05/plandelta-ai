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
    database_url: SecretStr | None = None
    storage_provider: str = Field(default="local", pattern=r"^(local|s3)$")
    local_storage_root: str = Field(default="/data", min_length=1, max_length=500)
    s3_bucket: str | None = None
    s3_prefix: str = Field(default="plandelta", min_length=1, max_length=200)
    s3_region: str = Field(default="us-east-1", min_length=1, max_length=50)
    knowledge_max_file_bytes: int = Field(ge=1, le=50 * 1024 * 1024)
    knowledge_max_pages: int = Field(ge=1, le=200)
    knowledge_chunk_size: int = Field(ge=400, le=4000)
    knowledge_chunk_overlap: int = Field(ge=0, le=800)
    vision_service_url: str = Field(default="http://vision:8000", min_length=8, max_length=500)
    vision_internal_secret: SecretStr | None = None

    @model_validator(mode="after")
    def provider_configuration_is_complete(self) -> AgentSettings:
        if self.chat_provider == "bedrock" and not self.bedrock_model_id:
            raise ValueError("BEDROCK_MODEL_ID is required when AGENT_CHAT_PROVIDER=bedrock.")
        if self.trace_content_enabled:
            raise ValueError("AGENT_TRACE_CONTENT_ENABLED must remain false.")
        if self.storage_provider == "s3" and not self.s3_bucket:
            raise ValueError("S3_BUCKET is required when STORAGE_PROVIDER=s3.")
        if self.knowledge_chunk_overlap >= self.knowledge_chunk_size:
            raise ValueError("KNOWLEDGE_CHUNK_OVERLAP must be smaller than KNOWLEDGE_CHUNK_SIZE.")
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
        database_url=(
            SecretStr(os.getenv("DIRECT_DATABASE_URL") or os.environ["DATABASE_URL"])
            if os.getenv("DIRECT_DATABASE_URL") or os.getenv("DATABASE_URL")
            else None
        ),
        storage_provider=os.getenv("STORAGE_PROVIDER", "local").lower(),
        local_storage_root=os.getenv("LOCAL_STORAGE_ROOT", "/data"),
        s3_bucket=os.getenv("S3_BUCKET") or None,
        s3_prefix=os.getenv("S3_PREFIX", "plandelta"),
        s3_region=os.getenv("S3_REGION", os.getenv("AWS_REGION", "us-east-1")),
        knowledge_max_file_bytes=int(os.getenv("KNOWLEDGE_MAX_FILE_BYTES", str(20 * 1024 * 1024))),
        knowledge_max_pages=int(os.getenv("KNOWLEDGE_MAX_PAGES", "100")),
        knowledge_chunk_size=int(os.getenv("KNOWLEDGE_CHUNK_SIZE", "1200")),
        knowledge_chunk_overlap=int(os.getenv("KNOWLEDGE_CHUNK_OVERLAP", "180")),
        vision_service_url=os.getenv("VISION_SERVICE_URL", "http://vision:8000"),
        vision_internal_secret=(
            SecretStr(os.environ["INTERNAL_SERVICE_SECRET"])
            if os.getenv("INTERNAL_SERVICE_SECRET")
            else None
        ),
    )
