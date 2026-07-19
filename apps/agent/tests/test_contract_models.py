from __future__ import annotations

from uuid import UUID

import pytest
from pydantic import ValidationError

from plandelta_agent.models.answers import AgentConfidence, RfiDraft, VerifiedAnswer
from plandelta_agent.models.evidence import Citation, NormalizedBox
from plandelta_agent.models.requests import ExecuteAgentRunRequest
from plandelta_agent.graph.synthesis import SynthesisDraft

RUN_ID = UUID("11111111-1111-4111-8111-111111111111")
PROJECT_ID = UUID("22222222-2222-4222-8222-222222222222")
CHANGE_ID = UUID("33333333-3333-4333-8333-333333333333")
CITATION_ID = UUID("44444444-4444-4444-8444-444444444444")


def test_request_contract_accepts_camel_case_transport() -> None:
    request = ExecuteAgentRunRequest.model_validate(
        {"runId": str(RUN_ID), "correlationId": "request:agent-1"}
    )

    assert request.run_id == RUN_ID
    assert request.model_dump(by_alias=True)["correlationId"] == "request:agent-1"


def test_normalized_box_cannot_exceed_drawing() -> None:
    with pytest.raises(ValidationError):
        NormalizedBox(x=0.9, y=0.1, width=0.2, height=0.2)


def test_verified_answer_requires_used_citation() -> None:
    with pytest.raises(ValidationError):
        VerifiedAnswer(
            status="verified",
            answer_markdown="A substantive claim.",
            confidence=AgentConfidence.HIGH,
            provider="bedrock",
            model_id="configured-model",
            prompt_version="agent-v1",
        )

    citation = Citation.model_validate(
        {
            "id": str(CITATION_ID),
            "projectId": str(PROJECT_ID),
            "label": "Change #1",
            "displayOrder": 1,
            "target": {
                "type": "visual_change",
                "analysisId": str(RUN_ID),
                "changeId": str(CHANGE_ID),
                "artifactId": None,
                "region": None,
            },
            "supportsClaimIds": ["claim-1"],
            "verified": True,
        }
    )
    answer = VerifiedAnswer(
        status="verified",
        answer_markdown="A cited claim [1].",
        confidence=AgentConfidence.HIGH,
        citations=[citation],
        provider="bedrock",
        model_id="configured-model",
        prompt_version="agent-v1",
    )

    assert answer.citations[0].target.type == "visual_change"


def test_rfi_draft_is_always_review_only() -> None:
    draft = RfiDraft(
        subject="Partition conflict",
        question="Which rating governs?",
        observed_conflict_or_change="Two sources disagree.",
        requested_clarification="Confirm the governing source.",
        impact_if_unresolved="Coordination may be delayed.",
        citation_ids=[CITATION_ID],
    )

    assert draft.status == "draft_requires_human_review"


def test_synthesis_draft_normalizes_non_boolean_rfi_output() -> None:
    draft = SynthesisDraft.model_validate(
        {
            "answerMarkdown": "One verified change is present.",
            "confidence": "high",
            "citedEvidenceIds": ["change:1"],
            "draftRfi": "No RFI draft provided because the evidence is clear.",
        }
    )

    assert draft.draft_rfi is False
