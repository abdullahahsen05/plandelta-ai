from __future__ import annotations

import asyncio
from collections.abc import Mapping

import pytest

from plandelta_agent.providers import (
    BedrockChatProvider,
    ChatMessage,
    ChatRequest,
    ChatRole,
    DeterministicChatProvider,
    LocalEmbeddingProvider,
    SafeProviderError,
)


def chat_request() -> ChatRequest:
    return ChatRequest(
        system_instruction="Return evidence-grounded JSON.",
        messages=[ChatMessage(role=ChatRole.USER, content="Summarize the cited change.")],
        max_output_tokens=100,
    )


class FakeBedrockClient:
    def __init__(self, response: Mapping[str, object] | None = None) -> None:
        self.response = response
        self.calls: list[dict[str, object]] = []

    def converse(self, **kwargs: object) -> Mapping[str, object]:
        self.calls.append(kwargs)
        if self.response is None:
            raise RuntimeError("private provider details must not escape")
        return self.response


def test_deterministic_provider_is_explicit_and_scripted() -> None:
    provider = DeterministicChatProvider(['{"status":"insufficient_evidence"}'])

    response = asyncio.run(provider.complete(chat_request()))

    assert response.provider == "deterministic"
    assert response.model_id is None
    assert response.stop_reason == "scripted"
    assert provider.call_count == 1


def test_deterministic_provider_never_invents_an_unscripted_answer() -> None:
    provider = DeterministicChatProvider()

    with pytest.raises(SafeProviderError, match="AGENT_MODEL_UNAVAILABLE"):
        asyncio.run(provider.complete(chat_request()))


def test_bedrock_provider_maps_converse_without_exposing_prompts() -> None:
    client = FakeBedrockClient(
        {
            "output": {"message": {"content": [{"text": '{"status":"verified"}'}]}},
            "usage": {"inputTokens": 25, "outputTokens": 8},
            "stopReason": "end_turn",
        }
    )
    provider = BedrockChatProvider(
        model_id="amazon.nova-micro-v1:0",
        region="us-east-1",
        timeout_seconds=2,
        correlation_id="provider-test",
        client=client,
    )

    response = asyncio.run(provider.complete(chat_request()))

    assert response.provider == "bedrock"
    assert response.model_id == "amazon.nova-micro-v1:0"
    assert response.input_tokens == 25
    assert response.output_tokens == 8
    assert response.stop_reason == "end_turn"
    assert len(client.calls) == 1
    assert client.calls[0].get("requestMetadata") == {"correlationId": "provider-test"}


def test_bedrock_provider_returns_only_a_safe_error_code() -> None:
    provider = BedrockChatProvider(
        model_id="amazon.nova-micro-v1:0",
        region="us-east-1",
        timeout_seconds=2,
        client=FakeBedrockClient(),
    )

    with pytest.raises(SafeProviderError) as captured:
        asyncio.run(provider.complete(chat_request()))

    assert str(captured.value) == "AGENT_MODEL_UNAVAILABLE"
    assert "private provider details" not in str(captured.value)


class FakeEmbeddingModel:
    def __init__(self, dimension: int) -> None:
        self.dimension = dimension
        self.calls = 0

    def embed(self, documents: list[str]) -> list[list[float]]:
        self.calls += 1
        return [
            [float(index) / self.dimension for index in range(self.dimension)] for _ in documents
        ]


def test_local_embeddings_load_lazily_and_record_metadata() -> None:
    model = FakeEmbeddingModel(384)
    factory_calls: list[str] = []

    def factory(model_name: str) -> FakeEmbeddingModel:
        factory_calls.append(model_name)
        return model

    provider = LocalEmbeddingProvider(
        model_name="BAAI/bge-small-en-v1.5",
        dimension=384,
        model_factory=factory,
    )
    assert provider.is_loaded is False
    assert factory_calls == []

    result = asyncio.run(provider.embed(["partition schedule", "door hardware"]))

    assert provider.is_loaded is True
    assert factory_calls == ["BAAI/bge-small-en-v1.5"]
    assert result.model == "BAAI/bge-small-en-v1.5"
    assert result.dimension == 384
    assert len(result.vectors) == 2
    assert len(result.vectors[0].values) == 384


def test_local_embeddings_reject_dimension_mismatch() -> None:
    provider = LocalEmbeddingProvider(
        model_name="test-model",
        dimension=384,
        model_factory=lambda _: FakeEmbeddingModel(64),
    )

    with pytest.raises(SafeProviderError, match="KNOWLEDGE_EMBEDDING_FAILED"):
        asyncio.run(provider.embed(["bounded text"]))
