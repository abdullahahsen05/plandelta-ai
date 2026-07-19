from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import Field

from plandelta_agent.models.base import ContractModel


class AgentRunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class AgentRunEvent(ContractModel):
    run_id: UUID
    sequence: int = Field(gt=0)
    type: Literal[
        "run.queued",
        "run.started",
        "run.status",
        "specialist.started",
        "specialist.completed",
        "tool.started",
        "tool.completed",
        "verification.started",
        "verification.repairing",
        "run.completed",
        "run.failed",
        "run.cancelled",
        "heartbeat",
    ]
    status: AgentRunStatus
    message: str = Field(min_length=1, max_length=240)
    timestamp: datetime
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
