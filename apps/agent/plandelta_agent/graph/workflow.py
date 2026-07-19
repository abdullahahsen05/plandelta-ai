from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Literal

from langgraph.graph import END, START, StateGraph
from pydantic import Field

from plandelta_agent.agents import SpecialistAgent, route_question
from plandelta_agent.graph.synthesis import EvidenceSynthesizer
from plandelta_agent.graph.verifier import AnswerVerifier
from plandelta_agent.guardrails import (
    BudgetLimitError,
    InputPolicyError,
    RunBudget,
    inspect_question,
)
from plandelta_agent.models.answers import VerifiedAnswer, VerifierResult
from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import SpecialistRole
from plandelta_agent.models.state import AgentGraphState, RunContext, SafeError
from plandelta_agent.providers import ChatProvider
from plandelta_agent.tools import ToolInvocationRecord, ToolPolicyError


class GraphTraceRecord(ContractModel):
    node: str = Field(min_length=1, max_length=80)
    event: str = Field(min_length=1, max_length=80)
    timestamp: datetime
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class GraphExecutionResult(ContractModel):
    answer: VerifiedAnswer
    verifier: VerifierResult
    selected_specialists: list[SpecialistRole]
    trace: list[GraphTraceRecord] = Field(max_length=100)
    model_turns: int
    tool_calls: int
    retrieved_chunks: int
    total_tokens: int
    estimated_cost_usd: float
    repair_passes: int
    safe_error: SafeError | None = None


class AgentWorkflow:
    def __init__(
        self,
        *,
        context: RunContext,
        provider: ChatProvider,
        specialists: Mapping[SpecialistRole, SpecialistAgent],
        tool_event_source: Callable[[], list[ToolInvocationRecord]] | None = None,
    ) -> None:
        self._context = context
        self._specialists = specialists
        self._tool_event_source = tool_event_source or (lambda: [])
        self._emitted_tool_events = 0
        self._budget = RunBudget(context.limits)
        self._synthesizer = EvidenceSynthesizer(provider)
        self._verifier = AnswerVerifier()
        self._trace_records: list[GraphTraceRecord] = []
        self._graph = self._build_graph()

    async def execute(self, question: str) -> GraphExecutionResult:
        initial: AgentGraphState = {
            "context": self._context,
            "question": question,
            "model_turns": 0,
            "tool_calls": 0,
            "retrieved_chunks": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0,
            "repair_passes": 0,
            "cancelled": False,
        }
        safe_error: SafeError | None = None
        try:
            async with asyncio.timeout(self._context.limits.timeout_seconds):
                state = await self._graph.ainvoke(
                    initial,
                    config={"recursion_limit": 12},
                )
        except TimeoutError:
            safe_error = SafeError(
                code="AGENT_TIMEOUT",
                message="The evidence run reached its configured time limit.",
                retryable=True,
            )
            state = self._safe_terminal_state(initial, safe_error)
            self._record("fallback", "safe_limit", {"code": safe_error.code})
        except (BudgetLimitError, InputPolicyError, ToolPolicyError) as error:
            code = error.code
            safe_error = SafeError(
                code=code,
                message="The evidence run stopped at a configured safety limit.",
                retryable=code in {"AGENT_TIMEOUT", "AGENT_TOOL_TIMEOUT", "AGENT_TOOL_FAILED"},
            )
            state = self._safe_terminal_state(initial, safe_error)
            self._record("fallback", "safe_limit", {"code": code})
        answer = state["candidate_answer"]
        verifier = state["verifier_result"]
        return GraphExecutionResult(
            answer=answer,
            verifier=verifier,
            selected_specialists=state.get("selected_specialists", []),
            trace=self._trace_records,
            model_turns=self._budget.model_turns,
            tool_calls=self._budget.tool_calls,
            retrieved_chunks=self._budget.retrieved_chunks,
            total_tokens=self._budget.total_tokens,
            estimated_cost_usd=self._budget.estimated_cost_usd,
            repair_passes=self._budget.repair_passes,
            safe_error=safe_error or state.get("safe_error"),
        )

    def _safe_terminal_state(
        self,
        initial: AgentGraphState,
        safe_error: SafeError,
    ) -> AgentGraphState:
        fallback = self._synthesizer.safe_fallback(
            "The evidence run stopped safely before a verified answer was available.",
            warnings=[safe_error.message],
        ).answer
        verifier = VerifierResult(
            approved=True,
            reason_codes=[],
            invalid_claim_ids=[],
            invalid_citation_ids=[],
            repairable=False,
        )
        return {
            **initial,
            "candidate_answer": fallback,
            "verifier_result": verifier,
            "selected_specialists": [],
            "safe_error": safe_error,
        }

    def _build_graph(self):  # type: ignore[no-untyped-def]
        graph = StateGraph(AgentGraphState)
        graph.add_node("intake", self._intake)
        graph.add_node("supervisor", self._supervisor)
        graph.add_node("specialists", self._run_specialists)
        graph.add_node("synthesis", self._synthesis)
        graph.add_node("verifier", self._verify)
        graph.add_node("repair", self._repair)
        graph.add_node("fallback", self._fallback)
        graph.add_edge(START, "intake")
        graph.add_edge("intake", "supervisor")
        graph.add_edge("supervisor", "specialists")
        graph.add_edge("specialists", "synthesis")
        graph.add_edge("synthesis", "verifier")
        graph.add_conditional_edges(
            "verifier",
            self._after_verifier,
            {"approved": END, "repair": "repair", "fallback": "fallback"},
        )
        graph.add_edge("repair", "synthesis")
        graph.add_edge("fallback", END)
        return graph.compile()

    async def _intake(self, state: AgentGraphState) -> dict[str, object]:
        guarded = inspect_question(state["question"])
        self._record(
            "intake",
            "completed",
            {"injectionSignalCount": len(guarded.injection_signals)},
        )
        return {
            "question": guarded.text,
            "injection_signals": guarded.injection_signals,
        }

    async def _supervisor(self, state: AgentGraphState) -> dict[str, object]:
        decision = route_question(
            state["question"],
            has_analysis=state["context"].analysis_id is not None,
        )
        self._budget.select_specialists(len(decision.specialists))
        self._record(
            "supervisor",
            "routed",
            {
                "intent": decision.intent,
                "specialistCount": len(decision.specialists),
                "reasonCodes": ",".join(decision.reason_codes),
            },
        )
        return {
            "intent": decision.intent,
            "route_reason_codes": decision.reason_codes,
            "selected_specialists": decision.specialists,
        }

    async def _run_specialists(self, state: AgentGraphState) -> dict[str, object]:
        selected = state["selected_specialists"]
        for role in selected:
            if role not in self._specialists:
                raise BudgetLimitError("AGENT_SPECIALIST_UNAVAILABLE")
        try:
            packets = await asyncio.gather(
                *[
                    self._specialists[role].run(
                        question=state["question"],
                        context=state["context"],
                        budget=self._budget,
                    )
                    for role in selected
                ]
            )
        finally:
            self._emit_tool_events()
        self._record(
            "specialists",
            "completed",
            {
                "specialistCount": len(packets),
                "evidenceCount": sum(len(packet.evidence) for packet in packets),
            },
        )
        return {"evidence_packets": packets}

    def _emit_tool_events(self) -> None:
        tool_events = self._tool_event_source()
        for event in tool_events[self._emitted_tool_events :]:
            self._record(
                f"tool.{event.name.value}",
                event.status,
                {
                    "version": event.version,
                    "specialist": event.specialist.value,
                    "resultCount": event.result_count,
                    "durationMs": event.duration_ms,
                    "errorCode": event.error_code,
                },
            )
        self._emitted_tool_events = len(tool_events)

    async def _synthesis(self, state: AgentGraphState) -> dict[str, object]:
        repair_reasons = (
            state["verifier_result"].reason_codes if state.get("repair_passes", 0) else None
        )
        outcome = await self._synthesizer.synthesize(
            question=state["question"],
            context=state["context"],
            packets=state["evidence_packets"],
            budget=self._budget,
            repair_reason_codes=repair_reasons,
        )
        self._record(
            "synthesis",
            "completed",
            {
                "citationCount": len(outcome.answer.citations),
                "invalidSourceCount": len(outcome.invalid_source_ids),
            },
        )
        return {
            "candidate_answer": outcome.answer,
            "invalid_source_ids": outcome.invalid_source_ids,
            **self._budget_state(),
        }

    async def _verify(self, state: AgentGraphState) -> dict[str, object]:
        result = self._verifier.verify(
            answer=state["candidate_answer"],
            context=state["context"],
            packets=state["evidence_packets"],
            invalid_source_ids=state.get("invalid_source_ids", []),
        )
        if result.approved:
            state["candidate_answer"] = state["candidate_answer"].model_copy(
                update={
                    "citations": [
                        citation.model_copy(update={"verified": True})
                        for citation in state["candidate_answer"].citations
                    ]
                }
            )
        self._record(
            "verifier",
            "approved" if result.approved else "rejected",
            {
                "reasonCount": len(result.reason_codes),
                "repairable": result.repairable,
            },
        )
        return {
            "candidate_answer": state["candidate_answer"],
            "verifier_result": result,
        }

    def _after_verifier(
        self,
        state: AgentGraphState,
    ) -> Literal["approved", "repair", "fallback"]:
        result = state["verifier_result"]
        if result.approved:
            return "approved"
        if (
            result.repairable
            and self._budget.repair_passes < self._context.limits.max_repair_passes
        ):
            return "repair"
        return "fallback"

    async def _repair(self, _state: AgentGraphState) -> dict[str, object]:
        self._budget.reserve_repair()
        self._record("repair", "started", {"repairPass": self._budget.repair_passes})
        return {"repair_passes": self._budget.repair_passes}

    async def _fallback(self, state: AgentGraphState) -> dict[str, object]:
        outcome = self._synthesizer.safe_fallback(
            "PlanDelta could not verify a supported answer from the available evidence.",
            warnings=["Review the cited project sources directly or ask a narrower question."],
        )
        self._record(
            "fallback",
            "completed",
            {"reasonCount": len(state["verifier_result"].reason_codes)},
        )
        return {"candidate_answer": outcome.answer}

    def _budget_state(self) -> dict[str, int | float]:
        return {
            "model_turns": self._budget.model_turns,
            "tool_calls": self._budget.tool_calls,
            "retrieved_chunks": self._budget.retrieved_chunks,
            "total_tokens": self._budget.total_tokens,
            "estimated_cost_usd": self._budget.estimated_cost_usd,
            "repair_passes": self._budget.repair_passes,
        }

    def _record(
        self,
        node: str,
        event: str,
        metadata: dict[str, str | int | float | bool | None],
    ) -> None:
        self._trace_records.append(
            GraphTraceRecord(
                node=node,
                event=event,
                timestamp=datetime.now(UTC),
                metadata=metadata,
            )
        )
