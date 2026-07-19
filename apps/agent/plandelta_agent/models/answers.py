from __future__ import annotations

from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import Citation


class AgentConfidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INSUFFICIENT = "insufficient"


class RfiDraft(ContractModel):
    subject: str = Field(min_length=1, max_length=200)
    question: str = Field(min_length=1, max_length=3000)
    observed_conflict_or_change: str = Field(min_length=1, max_length=3000)
    requested_clarification: str = Field(min_length=1, max_length=2000)
    impact_if_unresolved: str = Field(min_length=1, max_length=2000)
    citation_ids: list[UUID] = Field(min_length=1, max_length=20)
    status: Literal["draft_requires_human_review"] = "draft_requires_human_review"
    disclaimer: Literal["Draft — requires human review before use."] = (
        "Draft — requires human review before use."
    )


class VerifiedAnswer(ContractModel):
    status: Literal["verified", "conflicting_evidence", "insufficient_evidence"]
    answer_markdown: str = Field(min_length=1, max_length=12_000)
    confidence: AgentConfidence
    warnings: list[str] = Field(default_factory=list, max_length=20)
    citations: list[Citation] = Field(default_factory=list, max_length=30)
    rfi_draft: RfiDraft | None = None
    provider: Literal["bedrock", "deterministic"]
    model_id: str | None = Field(default=None, max_length=200)
    prompt_version: str = Field(min_length=1, max_length=80)

    @model_validator(mode="after")
    def substantive_answer_has_citations(self) -> VerifiedAnswer:
        if (
            self.status == "verified"
            and self.confidence != AgentConfidence.INSUFFICIENT
            and not self.citations
        ):
            raise ValueError("Verified substantive answers require citations.")
        return self


class VerifierResult(ContractModel):
    approved: bool
    reason_codes: list[str] = Field(default_factory=list, max_length=30)
    invalid_claim_ids: list[str] = Field(default_factory=list, max_length=40)
    invalid_citation_ids: list[UUID] = Field(default_factory=list, max_length=40)
    repairable: bool
