from __future__ import annotations

import re

from pydantic import Field

from plandelta_agent.models.base import ContractModel

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_INJECTION_SIGNALS = {
    "instruction_override": re.compile(
        r"\b(ignore|disregard|override|bypass)\b.{0,40}\b(instruction|policy|guardrail)",
        re.IGNORECASE,
    ),
    "prompt_exfiltration": re.compile(
        r"\b(system prompt|hidden prompt|developer message|chain[- ]of[- ]thought)\b",
        re.IGNORECASE,
    ),
    "tool_override": re.compile(
        r"\b(run|execute|call)\b.{0,30}\b(shell|sql|python|command|unlisted tool)\b",
        re.IGNORECASE,
    ),
    "scope_override": re.compile(
        r"\b(other|another|different)\b.{0,25}\b(project|user|tenant)\b",
        re.IGNORECASE,
    ),
}


class InputPolicyError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code)
        self.code = code
        self.safe_message = message


class GuardedQuestion(ContractModel):
    text: str = Field(min_length=1, max_length=4000)
    injection_signals: list[str] = Field(default_factory=list, max_length=10)


def detect_injection_signals(value: str) -> list[str]:
    normalized = " ".join(value.split())
    return [name for name, pattern in _INJECTION_SIGNALS.items() if pattern.search(normalized)]


def inspect_question(value: str) -> GuardedQuestion:
    normalized = " ".join(value.split())
    if not normalized:
        raise InputPolicyError("QUESTION_REQUIRED", "Enter a question about project evidence.")
    if len(normalized) > 4000:
        raise InputPolicyError(
            "QUESTION_TOO_LONG",
            "The question is too long. Keep it under 4,000 characters.",
        )
    if _CONTROL_CHARACTERS.search(value):
        raise InputPolicyError(
            "QUESTION_INVALID_CHARACTERS",
            "The question contains unsupported control characters.",
        )

    signals = detect_injection_signals(normalized)
    if {"tool_override", "scope_override"} & set(signals):
        raise InputPolicyError(
            "QUESTION_POLICY_VIOLATION",
            "PlanDelta can only read authorized evidence through its approved tools.",
        )
    return GuardedQuestion(text=normalized, injection_signals=signals)
