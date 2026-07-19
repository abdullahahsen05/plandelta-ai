from __future__ import annotations

import time
from hashlib import sha256

from plandelta_agent.models.state import RunLimits


class BudgetLimitError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class RunBudget:
    def __init__(self, limits: RunLimits) -> None:
        self.limits = limits
        self.started_at = time.monotonic()
        self.model_turns = 0
        self.tool_calls = 0
        self.retrieved_chunks = 0
        self.total_tokens = 0
        self.estimated_cost_usd = 0.0
        self.repair_passes = 0
        self._tool_fingerprints: set[str] = set()

    def check_deadline(self) -> None:
        if time.monotonic() - self.started_at >= self.limits.timeout_seconds:
            raise BudgetLimitError("AGENT_TIMEOUT")

    def select_specialists(self, count: int) -> None:
        self.check_deadline()
        if count > self.limits.max_specialists:
            raise BudgetLimitError("AGENT_SPECIALIST_LIMIT")

    def reserve_tool(self, name: str, canonical_arguments: str) -> None:
        self.check_deadline()
        fingerprint = sha256(f"{name}:{canonical_arguments}".encode()).hexdigest()
        if fingerprint in self._tool_fingerprints:
            raise BudgetLimitError("AGENT_DUPLICATE_TOOL_CALL")
        if self.tool_calls >= self.limits.max_tool_calls:
            raise BudgetLimitError("AGENT_TOOL_LIMIT")
        self._tool_fingerprints.add(fingerprint)
        self.tool_calls += 1

    def add_retrieved_chunks(self, count: int) -> None:
        if count < 0:
            raise ValueError("Retrieved chunk count cannot be negative.")
        if self.retrieved_chunks + count > self.limits.max_retrieved_chunks:
            raise BudgetLimitError("AGENT_RETRIEVAL_LIMIT")
        self.retrieved_chunks += count

    def record_model_turn(
        self,
        *,
        input_tokens: int,
        output_tokens: int,
        estimated_cost_usd: float,
    ) -> None:
        self.check_deadline()
        if self.model_turns >= self.limits.max_model_turns:
            raise BudgetLimitError("AGENT_MODEL_TURN_LIMIT")
        next_tokens = self.total_tokens + input_tokens + output_tokens
        next_cost = self.estimated_cost_usd + estimated_cost_usd
        if next_tokens > self.limits.max_total_tokens:
            raise BudgetLimitError("AGENT_TOKEN_LIMIT")
        if next_cost > self.limits.max_estimated_cost_usd:
            raise BudgetLimitError("AGENT_COST_LIMIT")
        self.model_turns += 1
        self.total_tokens = next_tokens
        self.estimated_cost_usd = next_cost

    def reserve_repair(self) -> None:
        self.check_deadline()
        if self.repair_passes >= self.limits.max_repair_passes:
            raise BudgetLimitError("AGENT_REPAIR_LIMIT")
        self.repair_passes += 1
