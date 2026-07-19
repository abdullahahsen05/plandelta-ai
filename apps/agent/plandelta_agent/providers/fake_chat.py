from __future__ import annotations

from collections import deque
from collections.abc import Iterable

from plandelta_agent.providers.chat import ChatRequest, ChatResponse, SafeProviderError


class DeterministicChatProvider:
    """Scripted test/local-failure provider that is never labelled as live AI."""

    def __init__(self, responses: Iterable[str] = ()) -> None:
        self._responses = deque(responses)
        self.call_count = 0

    @property
    def provider_name(self) -> str:
        return "deterministic"

    async def complete(self, request: ChatRequest) -> ChatResponse:
        self.call_count += 1
        if not self._responses:
            raise SafeProviderError("AGENT_MODEL_UNAVAILABLE", retryable=False)
        text = self._responses.popleft()
        return ChatResponse(
            text=text,
            provider=self.provider_name,
            model_id=None,
            input_tokens=0,
            output_tokens=0,
            stop_reason="scripted",
        )
