from __future__ import annotations

import asyncio
import logging
from uuid import uuid4

import pytest

from plandelta_agent.execution import (
    CancellationRegistry,
    ExecutionCancelledError,
    ExecutionTimedOutError,
)
from plandelta_agent.telemetry import log_safe_event, redact_metadata, safe_correlation_id


def test_sensitive_event_metadata_is_redacted(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="plandelta.agent"):
        log_safe_event(
            "tool_completed",
            "correlation-1",
            {
                "toolName": "hybrid_search",
                "prompt": "private question",
                "documentContent": "private document",
                "messageId": "private identifier",
                "rowCount": 2,
            },
        )

    output = caplog.text
    assert "private question" not in output
    assert "private document" not in output
    assert "private identifier" not in output
    assert "hybrid_search" in output
    assert '"rowCount":2' in output


def test_correlation_id_is_bounded() -> None:
    assert safe_correlation_id("request_123") == "request_123"
    assert safe_correlation_id("contains spaces") != "contains spaces"
    assert safe_correlation_id("x" * 101) != "x" * 101


def test_redaction_omits_nested_objects() -> None:
    assert redact_metadata({"safe": {"nested": "value"}}) == {"safe": "[OMITTED]"}


def test_execution_registry_times_out() -> None:
    async def scenario() -> None:
        registry = CancellationRegistry()
        with pytest.raises(ExecutionTimedOutError, match="AGENT_TIMEOUT"):
            await registry.run(uuid4(), asyncio.sleep(1), timeout_seconds=0.01)

    asyncio.run(scenario())


def test_execution_registry_cancels_an_active_run() -> None:
    async def scenario() -> None:
        registry = CancellationRegistry()
        run_id = uuid4()
        active = asyncio.create_task(registry.run(run_id, asyncio.sleep(1), timeout_seconds=2))
        await asyncio.sleep(0)
        assert await registry.cancel(run_id) is True
        with pytest.raises(ExecutionCancelledError, match="AGENT_CANCELLED"):
            await active
        assert await registry.cancel(run_id) is False

    asyncio.run(scenario())
