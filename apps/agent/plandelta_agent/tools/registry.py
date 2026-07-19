from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Iterable
from enum import StrEnum

from pydantic import Field

from plandelta_agent.guardrails.budgets import RunBudget
from plandelta_agent.models.base import ContractModel
from plandelta_agent.models.evidence import EvidenceReference, SpecialistRole
from plandelta_agent.models.state import RunContext

_SERVER_SCOPE_FIELDS = frozenset({"owner_id", "project_id", "analysis_id", "user_id"})


class ToolName(StrEnum):
    LIST_VISUAL_CHANGES = "list_visual_changes"
    GET_VISUAL_EVIDENCE = "get_visual_evidence"
    HYBRID_SEARCH = "hybrid_search"
    GET_SOURCE_PAGE = "get_source_page"
    APPLY_PROFILE_IMPACT_RULES = "apply_profile_impact_rules"
    CALCULATE_EVIDENCE_QUANTITY = "calculate_evidence_quantity"


class ToolPolicyError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class ToolResult(ContractModel):
    evidence: list[EvidenceReference] = Field(default_factory=list, max_length=20)
    warnings: list[str] = Field(default_factory=list, max_length=20)


ToolHandler = Callable[[ContractModel, RunContext], Awaitable[ToolResult]]


class ToolDefinition(ContractModel):
    name: ToolName
    version: str = Field(min_length=1, max_length=20)
    allowed_specialists: frozenset[SpecialistRole]
    arguments_model: type[ContractModel]
    timeout_seconds: float = Field(gt=0, le=15)
    max_results: int = Field(ge=1, le=20)
    handler: ToolHandler


class ToolRegistry:
    def __init__(self, definitions: Iterable[ToolDefinition]) -> None:
        self._definitions: dict[ToolName, ToolDefinition] = {}
        for definition in definitions:
            if definition.name in self._definitions:
                raise ValueError(f"Duplicate tool definition: {definition.name}")
            self._definitions[definition.name] = definition

    async def invoke(
        self,
        *,
        name: ToolName,
        specialist: SpecialistRole,
        arguments: dict[str, object],
        context: RunContext,
        budget: RunBudget,
    ) -> ToolResult:
        definition = self._definitions.get(name)
        if definition is None:
            raise ToolPolicyError("AGENT_TOOL_NOT_ALLOWED")
        if specialist not in definition.allowed_specialists:
            raise ToolPolicyError("AGENT_TOOL_ROLE_DENIED")
        if _SERVER_SCOPE_FIELDS & set(arguments):
            raise ToolPolicyError("AGENT_TOOL_SCOPE_OVERRIDE")
        try:
            validated = definition.arguments_model.model_validate(arguments)
        except ValueError as error:
            raise ToolPolicyError("AGENT_TOOL_ARGUMENTS_INVALID") from error

        budget.reserve_tool(name.value, validated.model_dump_json())
        try:
            async with asyncio.timeout(definition.timeout_seconds):
                result = await definition.handler(validated, context)
        except TimeoutError as error:
            raise ToolPolicyError("AGENT_TOOL_TIMEOUT") from error
        if len(result.evidence) > definition.max_results:
            raise ToolPolicyError("AGENT_TOOL_RESULT_LIMIT")
        if any(reference.project_id != context.project_id for reference in result.evidence):
            raise ToolPolicyError("AGENT_TOOL_SCOPE_VIOLATION")
        budget.add_retrieved_chunks(
            sum(reference.source_type == "document_chunk" for reference in result.evidence)
        )
        return result
