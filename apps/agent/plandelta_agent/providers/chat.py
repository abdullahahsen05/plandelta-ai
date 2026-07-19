from __future__ import annotations

from enum import StrEnum
from typing import Protocol

from pydantic import Field

from plandelta_agent.models.base import ContractModel


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(ContractModel):
    role: ChatRole
    content: str = Field(min_length=1, max_length=12_000)


class ChatRequest(ContractModel):
    system_instruction: str = Field(min_length=1, max_length=6000)
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    max_output_tokens: int = Field(default=1200, ge=1, le=4000)
    temperature: float = Field(default=0, ge=0, le=1)


class ChatResponse(ContractModel):
    text: str = Field(min_length=1, max_length=24_000)
    provider: str = Field(min_length=1, max_length=40)
    model_id: str | None = Field(default=None, max_length=200)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    stop_reason: str = Field(default="unknown", min_length=1, max_length=80)


class SafeProviderError(RuntimeError):
    def __init__(self, code: str, *, retryable: bool) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = retryable


class ChatProvider(Protocol):
    @property
    def provider_name(self) -> str: ...

    async def complete(self, request: ChatRequest) -> ChatResponse: ...
