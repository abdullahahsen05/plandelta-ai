from __future__ import annotations

from typing import TYPE_CHECKING

import psycopg
from psycopg.types.json import Jsonb

from plandelta_agent.models.state import RunContext

if TYPE_CHECKING:
    from plandelta_agent.graph.workflow import GraphExecutionResult, GraphTraceRecord


class GraphPersistenceError(RuntimeError):
    pass


class PostgresGraphResultSink:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise ValueError("A database URL is required.")
        self._database_url = database_url

    async def persist(
        self,
        context: RunContext,
        result: GraphExecutionResult,
    ) -> None:
        async with (
            await psycopg.AsyncConnection.connect(self._database_url) as connection,
            connection.transaction(),
        ):
            owned = await connection.execute(
                """
                    SELECT r.id
                    FROM agent_runs r
                    JOIN projects p ON p.id = r.project_id
                    WHERE r.id = %s
                      AND r.project_id = %s
                      AND p.owner_id = %s
                    FOR UPDATE
                    """,
                (context.run_id, context.project_id, context.owner_id),
            )
            if await owned.fetchone() is None:
                raise GraphPersistenceError("AGENT_RUN_SCOPE_INVALID")
            for sequence, record in enumerate(result.trace, start=1):
                await connection.execute(
                    """
                        INSERT INTO agent_steps (
                          agent_run_id, sequence, node_name, node_version, event_type,
                          status, safe_summary, reason_code, metadata, duration_ms,
                          input_tokens, output_tokens, estimated_cost_usd, error_code
                        ) VALUES (
                          %s, %s, %s, '1', %s, %s::"AgentStepStatus", %s, %s,
                          %s::jsonb, %s, 0, 0, 0, %s
                        )
                        ON CONFLICT (agent_run_id, sequence) DO UPDATE SET
                          node_name = EXCLUDED.node_name,
                          node_version = EXCLUDED.node_version,
                          event_type = EXCLUDED.event_type,
                          status = EXCLUDED.status,
                          safe_summary = EXCLUDED.safe_summary,
                          reason_code = EXCLUDED.reason_code,
                          metadata = EXCLUDED.metadata,
                          duration_ms = EXCLUDED.duration_ms,
                          error_code = EXCLUDED.error_code
                        """,
                    self._step_values(context, sequence, record),
                )
            await connection.execute(
                """
                    UPDATE agent_runs
                    SET selected_specialists = %s,
                        model_turn_count = %s,
                        tool_call_count = %s,
                        retrieved_chunk_count = %s,
                        repair_count = %s,
                        input_tokens = %s,
                        output_tokens = %s,
                        estimated_cost_usd = %s,
                        verifier_outcome = %s,
                        failure_code = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                (
                    [role.value for role in result.selected_specialists],
                    result.model_turns,
                    result.tool_calls,
                    result.retrieved_chunks,
                    result.repair_passes,
                    result.input_tokens,
                    result.output_tokens,
                    result.estimated_cost_usd,
                    "approved" if result.verifier.approved else "safe_fallback",
                    result.safe_error.code if result.safe_error else None,
                    context.run_id,
                ),
            )

    @staticmethod
    def _step_values(
        context: RunContext,
        sequence: int,
        record: GraphTraceRecord,
    ) -> tuple[object, ...]:
        status = (
            "failed"
            if record.event == "failed"
            else "blocked"
            if record.event in {"rejected", "safe_limit"}
            else "started"
            if record.event == "started"
            else "completed"
        )
        error_code = record.metadata.get("errorCode") or (
            record.metadata.get("code") if record.event == "safe_limit" else None
        )
        reason_code = (
            "VERIFIER_REJECTED"
            if record.event == "rejected"
            else str(error_code)
            if error_code
            else None
        )
        duration = record.metadata.get("durationMs")
        return (
            context.run_id,
            sequence,
            record.node,
            record.event,
            status,
            f"Structured {record.node} {record.event} event.",
            reason_code,
            Jsonb(record.metadata),
            duration if isinstance(duration, int) else None,
            str(error_code) if error_code else None,
        )
