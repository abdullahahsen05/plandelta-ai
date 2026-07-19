from __future__ import annotations

import re

from plandelta_agent.models.answers import AgentConfidence, VerifiedAnswer, VerifierResult
from plandelta_agent.models.evidence import (
    DocumentCitationTarget,
    EvidencePacket,
    VisualCitationTarget,
)
from plandelta_agent.models.state import RunContext

_PROHIBITED_CLAIMS = re.compile(
    r"\b(approved|certified|guaranteed cost|code[- ]compliant|safe to construct)\b",
    re.IGNORECASE,
)


class AnswerVerifier:
    def verify(
        self,
        *,
        answer: VerifiedAnswer,
        context: RunContext,
        packets: list[EvidencePacket],
        invalid_source_ids: list[str],
    ) -> VerifierResult:
        reason_codes: list[str] = []
        invalid_citations = []
        references = [
            reference
            for packet in packets
            for reference in packet.evidence
            if reference.citation_target is not None
        ]
        allowed_targets = {
            reference.citation_target.model_dump_json(): reference
            for reference in references
            if reference.citation_target is not None
        }

        if invalid_source_ids:
            reason_codes.append("CITATION_SOURCE_NOT_IN_EVIDENCE")
        if _PROHIBITED_CLAIMS.search(answer.answer_markdown):
            reason_codes.append("PROHIBITED_DECISION_CLAIM")
        if (
            answer.status == "verified"
            and answer.confidence != AgentConfidence.INSUFFICIENT
            and not answer.citations
        ):
            reason_codes.append("SUBSTANTIVE_CLAIM_UNCITED")

        conflict_references = [reference for reference in references if reference.is_conflicting]
        if conflict_references and answer.status != "conflicting_evidence":
            reason_codes.append("CONFLICT_NOT_DISCLOSED")
        if answer.status == "conflicting_evidence" and len(answer.citations) < 2:
            reason_codes.append("CONFLICT_REQUIRES_MULTIPLE_SOURCES")

        for citation in answer.citations:
            invalid = False
            if citation.project_id != context.project_id:
                invalid = True
            serialized = citation.target.model_dump_json()
            reference = allowed_targets.get(serialized)
            if reference is None:
                invalid = True
            elif isinstance(citation.target, DocumentCitationTarget):
                if not citation.target.is_active and not citation.target.is_conflicting:
                    invalid = True
                if citation.target.excerpt != reference.citation_target.excerpt:  # type: ignore[union-attr]
                    invalid = True
            elif (
                isinstance(citation.target, VisualCitationTarget)
                and citation.target.analysis_id != context.analysis_id
            ):
                invalid = True
            if not citation.supports_claim_ids:
                invalid = True
            if invalid:
                invalid_citations.append(citation.id)

        if invalid_citations:
            reason_codes.append("CITATION_VALIDATION_FAILED")
        approved = not reason_codes
        return VerifierResult(
            approved=approved,
            reason_codes=list(dict.fromkeys(reason_codes)),
            invalid_claim_ids=(
                ["claim-1"]
                if {
                    "SUBSTANTIVE_CLAIM_UNCITED",
                    "PROHIBITED_DECISION_CLAIM",
                    "CONFLICT_NOT_DISCLOSED",
                }
                & set(reason_codes)
                else []
            ),
            invalid_citation_ids=list(dict.fromkeys(invalid_citations)),
            repairable=not approved and not {"CITATION_VALIDATION_FAILED"} & set(reason_codes),
        )
