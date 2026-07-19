from uuid import uuid4

from plandelta_agent.graph import AnswerVerifier
from plandelta_agent.models.answers import AgentConfidence, VerifiedAnswer
from plandelta_agent.models.evidence import (
    AnalysisProfileId,
    Citation,
    DocumentCitationTarget,
    EvidencePacket,
    EvidenceReference,
    SpecialistRole,
)
from plandelta_agent.models.state import RunContext, RunLimits


def context() -> RunContext:
    return RunContext(
        owner_id=uuid4(),
        project_id=uuid4(),
        conversation_id=uuid4(),
        message_id=uuid4(),
        run_id=uuid4(),
        correlation_id="verifier-policy",
        profile_id=AnalysisProfileId.CONSTRUCTION_DRAWING,
        limits=RunLimits(
            max_model_turns=3,
            max_tool_calls=6,
            max_retrieved_chunks=6,
            max_repair_passes=1,
            timeout_seconds=30,
            max_estimated_cost_usd=0.02,
        ),
    )


def source(
    run_context: RunContext,
    *,
    active: bool,
    conflicting: bool,
    label: str,
) -> tuple[EvidenceReference, Citation]:
    document_id = uuid4()
    target = DocumentCitationTarget(
        type="document_chunk",
        document_id=document_id,
        document_version_id=uuid4(),
        chunk_id=uuid4(),
        page=2,
        section="Partition rating",
        excerpt=f"{label} partition evidence.",
        is_active=active,
        is_conflicting=conflicting,
    )
    reference = EvidenceReference(
        evidence_id=f"document:{label}",
        source_type="document_chunk",
        project_id=run_context.project_id,
        source_id=target.chunk_id,
        summary=target.excerpt,
        confidence=0.9,
        is_active=active,
        is_conflicting=conflicting,
        citation_target=target,
    )
    citation = Citation(
        id=uuid4(),
        project_id=run_context.project_id,
        label=label,
        display_order=1,
        target=target,
        supports_claim_ids=["claim-1"],
        verified=False,
    )
    return reference, citation


def packet(references: list[EvidenceReference]) -> EvidencePacket:
    return EvidencePacket(
        specialist=SpecialistRole.KNOWLEDGE,
        intent="document_requirements",
        evidence=references,
        insufficient_evidence=False,
    )


def answer(
    citations: list[Citation],
    *,
    status: str = "conflicting_evidence",
) -> VerifiedAnswer:
    return VerifiedAnswer.model_validate(
        {
            "status": status,
            "answerMarkdown": "The two recorded revisions conflict and require human review.",
            "confidence": AgentConfidence.LOW,
            "citations": citations,
            "provider": "deterministic",
            "promptVersion": "test",
        }
    )


def test_verifier_accepts_explicit_active_and_older_conflicting_sources() -> None:
    run_context = context()
    active_reference, active_citation = source(
        run_context,
        active=True,
        conflicting=True,
        label="Current revision",
    )
    old_reference, old_citation = source(
        run_context,
        active=False,
        conflicting=True,
        label="Older revision",
    )
    old_citation = old_citation.model_copy(update={"display_order": 2})

    result = AnswerVerifier().verify(
        answer=answer([active_citation, old_citation]),
        context=run_context,
        packets=[packet([active_reference, old_reference])],
        invalid_source_ids=[],
    )

    assert result.approved is True


def test_verifier_rejects_silent_stale_source_and_one_sided_conflict() -> None:
    run_context = context()
    stale_reference, stale_citation = source(
        run_context,
        active=False,
        conflicting=False,
        label="Stale revision",
    )
    stale = AnswerVerifier().verify(
        answer=answer([stale_citation], status="verified"),
        context=run_context,
        packets=[packet([stale_reference])],
        invalid_source_ids=[],
    )
    assert stale.approved is False
    assert "CITATION_VALIDATION_FAILED" in stale.reason_codes

    conflict_reference, conflict_citation = source(
        run_context,
        active=True,
        conflicting=True,
        label="Only one side",
    )
    one_sided = AnswerVerifier().verify(
        answer=answer([conflict_citation]),
        context=run_context,
        packets=[packet([conflict_reference])],
        invalid_source_ids=[],
    )
    assert one_sided.approved is False
    assert "CONFLICT_REQUIRES_MULTIPLE_SOURCES" in one_sided.reason_codes
