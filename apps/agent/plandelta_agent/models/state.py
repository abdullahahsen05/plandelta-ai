from __future__ import annotations

from typing import TypedDict
from uuid import UUID

from pydantic import Field

from plandelta_agent.models.answers import VerifiedAnswer, VerifierResult
from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import AnalysisProfileId, EvidencePacket, SpecialistRole


class RunLimits(ContractModel):
    max_model_turns: int = Field(ge=1, le=8)
    max_tool_calls: int = Field(ge=1, le=12)
    max_specialists: int = Field(default=3, ge=1, le=3)
    max_retrieved_chunks: int = Field(ge=1, le=12)
    max_total_tokens: int = Field(default=12_000, ge=500, le=40_000)
    max_repair_passes: int = Field(ge=0, le=1)
    timeout_seconds: int = Field(ge=5, le=120)
    max_estimated_cost_usd: float = Field(gt=0, le=0.05)


class RunContext(ContractModel):
    owner_id: UUID
    project_id: UUID
    conversation_id: UUID
    message_id: UUID
    run_id: UUID
    analysis_id: UUID | None = None
    correlation_id: str = Field(min_length=1, max_length=100)
    profile_id: AnalysisProfileId
    limits: RunLimits


class SafeError(ContractModel):
    code: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=240)
    retryable: bool


class AgentGraphState(TypedDict, total=False):
    context: RunContext
    question: str
    selected_specialists: list[SpecialistRole]
    evidence_packets: list[EvidencePacket]
    candidate_answer: VerifiedAnswer
    verifier_result: VerifierResult
    model_turns: int
    tool_calls: int
    repair_passes: int
    cancelled: bool
    safe_error: SafeError
