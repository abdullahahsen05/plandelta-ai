import { Injectable } from "@nestjs/common";

import {
  agentExecutionResponseSchema,
  type AgentExecutionResponse,
} from "./agent-response.schema.js";

@Injectable()
export class AgentServiceClient {
  private get configuration() {
    const token = process.env.AGENT_INTERNAL_TOKEN;
    if (!token || token.length < 32) throw new Error("AGENT_INTERNAL_TOKEN is not configured.");
    return {
      baseUrl: (process.env.AGENT_SERVICE_URL ?? "http://agent:8100").replace(/\/$/, ""),
      token,
      timeoutMs: Number(process.env.AGENT_REQUEST_TIMEOUT_MS ?? 75_000),
    };
  }

  async executeIngestion(jobId: string, correlationId: string, signal?: AbortSignal) {
    await this.request(
      `/internal/v1/ingestion-jobs/${jobId}/execute`,
      { jobId, correlationId },
      signal,
    );
  }

  async executeRun(
    runId: string,
    correlationId: string,
    signal?: AbortSignal,
  ): Promise<AgentExecutionResponse> {
    const payload = await this.request(
      `/internal/v1/agent-runs/${runId}/execute`,
      { runId, correlationId },
      signal,
    );
    return agentExecutionResponseSchema.parse(payload);
  }

  private async request(
    path: string,
    body: Record<string, string>,
    externalSignal?: AbortSignal,
  ): Promise<unknown> {
    const configuration = this.configuration;
    const timeoutSignal = AbortSignal.timeout(configuration.timeoutMs);
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;
    const response = await fetch(`${configuration.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-plandelta-internal-token": configuration.token,
        "x-correlation-id": body.correlationId ?? "",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Agent service returned HTTP ${response.status}.`);
    }
    const payload: unknown = await response.json();
    return payload;
  }
}
