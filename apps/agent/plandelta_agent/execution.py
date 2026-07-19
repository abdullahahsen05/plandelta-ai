from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from contextlib import suppress
from typing import TypeVar
from uuid import UUID

Result = TypeVar("Result")


class ExecutionCancelledError(RuntimeError):
    pass


class ExecutionTimedOutError(RuntimeError):
    pass


class CancellationRegistry:
    def __init__(self) -> None:
        self._events: dict[UUID, asyncio.Event] = {}
        self._lock = asyncio.Lock()

    async def cancel(self, run_id: UUID) -> bool:
        async with self._lock:
            event = self._events.get(run_id)
            if event is None:
                return False
            event.set()
            return True

    async def run(
        self,
        run_id: UUID,
        operation: Awaitable[Result],
        *,
        timeout_seconds: float,
    ) -> Result:
        if timeout_seconds <= 0:
            raise ValueError("The execution timeout must be positive.")
        async with self._lock:
            if run_id in self._events:
                raise RuntimeError("The run is already active.")
            cancellation = asyncio.Event()
            self._events[run_id] = cancellation

        operation_task = asyncio.ensure_future(operation)
        cancellation_task = asyncio.create_task(cancellation.wait())
        try:
            done, _ = await asyncio.wait(
                {operation_task, cancellation_task},
                timeout=timeout_seconds,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if cancellation_task in done:
                operation_task.cancel()
                with suppress(asyncio.CancelledError):
                    await operation_task
                raise ExecutionCancelledError("AGENT_CANCELLED")
            if operation_task not in done:
                operation_task.cancel()
                with suppress(asyncio.CancelledError):
                    await operation_task
                raise ExecutionTimedOutError("AGENT_TIMEOUT")
            return operation_task.result()
        finally:
            cancellation_task.cancel()
            with suppress(asyncio.CancelledError):
                await cancellation_task
            async with self._lock:
                self._events.pop(run_id, None)
