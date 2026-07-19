from __future__ import annotations

from uuid import UUID

from pydantic import Field

from plandelta_agent.models.base import ContractModel


class ExecuteAgentRunRequest(ContractModel):
    run_id: UUID
    correlation_id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")


class ExecuteIngestionJobRequest(ContractModel):
    job_id: UUID
    correlation_id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")
