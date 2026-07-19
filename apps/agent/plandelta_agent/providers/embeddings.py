from __future__ import annotations

from typing import Protocol

from pydantic import Field

from plandelta_agent.models.base import ContractModel


class EmbeddingVector(ContractModel):
    values: list[float] = Field(min_length=64, max_length=2048)


class EmbeddingBatch(ContractModel):
    model: str = Field(min_length=1, max_length=200)
    dimension: int = Field(ge=64, le=2048)
    vectors: list[EmbeddingVector] = Field(min_length=1, max_length=32)


class EmbeddingProvider(Protocol):
    @property
    def is_loaded(self) -> bool: ...

    async def embed(self, texts: list[str]) -> EmbeddingBatch: ...
