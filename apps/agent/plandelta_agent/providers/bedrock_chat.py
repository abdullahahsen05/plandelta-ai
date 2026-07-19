from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Protocol, cast

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]

from plandelta_agent.providers.chat import ChatRequest, ChatResponse, SafeProviderError


class BedrockRuntimeClient(Protocol):
    def converse(self, **kwargs: object) -> Mapping[str, object]: ...


class BedrockChatProvider:
    def __init__(
        self,
        *,
        model_id: str,
        region: str,
        timeout_seconds: float,
        client: BedrockRuntimeClient | None = None,
    ) -> None:
        if not model_id.strip():
            raise ValueError("A Bedrock model ID is required.")
        if timeout_seconds <= 0:
            raise ValueError("The provider timeout must be positive.")
        self._model_id = model_id.strip()
        self._timeout_seconds = timeout_seconds
        self._client = client or cast(
            BedrockRuntimeClient,
            boto3.client(
                "bedrock-runtime",
                region_name=region,
                config=Config(
                    connect_timeout=min(timeout_seconds, 5),
                    read_timeout=timeout_seconds,
                    retries={"max_attempts": 2, "mode": "standard"},
                ),
            ),
        )

    @property
    def provider_name(self) -> str:
        return "bedrock"

    async def complete(self, request: ChatRequest) -> ChatResponse:
        try:
            async with asyncio.timeout(self._timeout_seconds):
                response = await asyncio.to_thread(self._converse, request)
        except TimeoutError as error:
            raise SafeProviderError("AGENT_TIMEOUT", retryable=True) from error
        except SafeProviderError:
            raise
        except Exception as error:
            raise SafeProviderError("AGENT_MODEL_UNAVAILABLE", retryable=True) from error
        return self._parse_response(response)

    def _converse(self, request: ChatRequest) -> Mapping[str, object]:
        return self._client.converse(
            modelId=self._model_id,
            system=[{"text": request.system_instruction}],
            messages=[
                {
                    "role": message.role.value,
                    "content": [{"text": message.content}],
                }
                for message in request.messages
            ],
            inferenceConfig={
                "maxTokens": request.max_output_tokens,
                "temperature": request.temperature,
            },
        )

    def _parse_response(self, response: Mapping[str, object]) -> ChatResponse:
        output = response.get("output")
        if not isinstance(output, Mapping):
            raise SafeProviderError("AGENT_MODEL_UNAVAILABLE", retryable=True)
        message = output.get("message")
        if not isinstance(message, Mapping):
            raise SafeProviderError("AGENT_MODEL_UNAVAILABLE", retryable=True)
        content = message.get("content")
        if not isinstance(content, list):
            raise SafeProviderError("AGENT_MODEL_UNAVAILABLE", retryable=True)
        text_parts: list[str] = []
        for item in content:
            if not isinstance(item, Mapping):
                continue
            text_value = item.get("text")
            if isinstance(text_value, str):
                text_parts.append(text_value)
        text = "".join(text_parts).strip()
        if not text:
            raise SafeProviderError("AGENT_MODEL_UNAVAILABLE", retryable=True)

        usage = response.get("usage")
        input_tokens = self._token_count(usage, "inputTokens")
        output_tokens = self._token_count(usage, "outputTokens")
        stop_reason = response.get("stopReason")
        return ChatResponse(
            text=text,
            provider=self.provider_name,
            model_id=self._model_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            stop_reason=stop_reason if isinstance(stop_reason, str) else "unknown",
        )

    @staticmethod
    def _token_count(usage: object, name: str) -> int:
        if not isinstance(usage, Mapping):
            return 0
        value = usage.get(name)
        return value if isinstance(value, int) and value >= 0 else 0
