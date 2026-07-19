from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from plandelta_agent.models.base import ContractModel


class AnalysisProfileId(StrEnum):
    CONSTRUCTION_DRAWING = "construction_drawing"
    ENGINEERING_SCHEMATIC = "engineering_schematic"


class SpecialistRole(StrEnum):
    VISUAL = "visual"
    KNOWLEDGE = "knowledge"
    IMPACT = "impact"


class NormalizedBox(ContractModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def within_drawing(self) -> NormalizedBox:
        if self.x + self.width > 1 or self.y + self.height > 1:
            raise ValueError("Normalized box exceeds the drawing boundary.")
        return self


class VisualCitationTarget(ContractModel):
    type: Literal["visual_change"]
    analysis_id: UUID
    change_id: UUID
    artifact_id: UUID | None = None
    region: NormalizedBox | None = None


class DocumentCitationTarget(ContractModel):
    type: Literal["document_chunk"]
    document_id: UUID
    document_version_id: UUID
    chunk_id: UUID
    page: int = Field(gt=0)
    section: str | None = Field(default=None, max_length=240)
    excerpt: str = Field(min_length=1, max_length=1200)
    is_active: bool
    is_conflicting: bool


CitationTarget = Annotated[
    VisualCitationTarget | DocumentCitationTarget,
    Field(discriminator="type"),
]


class Citation(ContractModel):
    id: UUID
    project_id: UUID
    label: str = Field(min_length=1, max_length=120)
    display_order: int = Field(gt=0)
    target: CitationTarget
    supports_claim_ids: list[str] = Field(default_factory=list, max_length=40)
    verified: bool


class EvidenceReference(ContractModel):
    evidence_id: str = Field(min_length=1, max_length=120)
    source_type: Literal["visual_change", "document_chunk", "profile_rule"]
    project_id: UUID
    analysis_id: UUID | None = None
    source_id: UUID | None = None
    summary: str = Field(min_length=1, max_length=800)
    confidence: float = Field(ge=0, le=1)
    is_active: bool
    is_conflicting: bool
    citation_target: CitationTarget | None = None


class EvidencePacket(ContractModel):
    specialist: SpecialistRole
    intent: str = Field(min_length=1, max_length=80)
    evidence: list[EvidenceReference] = Field(default_factory=list, max_length=20)
    warnings: list[str] = Field(default_factory=list, max_length=20)
    insufficient_evidence: bool
