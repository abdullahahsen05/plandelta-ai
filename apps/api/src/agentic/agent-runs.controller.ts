import {
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Sse,
} from "@nestjs/common";
import { ApiBearerAuth, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Observable } from "rxjs";

import { CurrentAuth } from "../auth/current-auth.decorator.js";
import type { AuthContext } from "../auth/auth.types.js";
import { ConversationsService } from "./conversations.service.js";

const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"]);

@ApiTags("evidence copilot runs")
@ApiBearerAuth()
@Controller("agent-runs")
export class AgentRunsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get(":runId")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("runId", new ParseUUIDPipe()) runId: string,
  ) {
    return this.conversations.run(auth.userId, runId);
  }

  @Post(":runId/retry")
  retry(
    @CurrentAuth() auth: AuthContext,
    @Param("runId", new ParseUUIDPipe()) runId: string,
    @Req() request: Request,
  ) {
    return this.conversations.retry(auth.userId, runId, request.correlationId ?? "missing");
  }

  @Post(":runId/cancel")
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param("runId", new ParseUUIDPipe()) runId: string,
  ) {
    return this.conversations.cancel(auth.userId, runId);
  }

  @Sse(":runId/events")
  @ApiProduces("text/event-stream")
  events(
    @CurrentAuth() auth: AuthContext,
    @Param("runId", new ParseUUIDPipe()) runId: string,
    @Req() request: Request,
  ): Observable<MessageEvent> {
    const initialSequence = Number(request.header("last-event-id") ?? 0);
    return new Observable<MessageEvent>((subscriber) => {
      let sequence = Number.isSafeInteger(initialSequence) && initialSequence > 0 ? initialSequence : 0;
      let active = true;
      let terminalEmitted = false;
      const poll = async () => {
        if (!active) return;
        try {
          const [run, steps] = await Promise.all([
            this.conversations.run(auth.userId, runId),
            this.conversations.steps(auth.userId, runId, sequence),
          ]);
          for (const step of steps) {
            sequence = step.sequence;
            subscriber.next({
              id: String(step.sequence),
              type: this.safeEventType(step.nodeName, step.eventType),
              data: {
                runId,
                sequence: step.sequence,
                status: run.status.toLowerCase(),
                message: step.safeSummary ?? "Evidence processing updated.",
                timestamp: step.createdAt.toISOString(),
                metadata: this.safeMetadata(step.metadata),
              },
            });
          }
          if (terminalStatuses.has(run.status) && !terminalEmitted) {
            terminalEmitted = true;
            sequence += 1;
            subscriber.next({
              id: String(sequence),
              type: this.terminalEvent(run.status),
              data: {
                runId,
                sequence,
                status: run.status.toLowerCase(),
                message: this.terminalMessage(run.status),
                timestamp: (run.completedAt ?? run.updatedAt).toISOString(),
                metadata: run.failureCode ? { failureCode: run.failureCode } : {},
              },
            });
            subscriber.complete();
          } else if (steps.length === 0) {
            subscriber.next({
              type: "heartbeat",
              data: {
                runId,
                sequence,
                status: run.status.toLowerCase(),
                message: "Waiting for the next safe status update.",
                timestamp: new Date().toISOString(),
                metadata: {},
              },
            });
          }
        } catch (error) {
          subscriber.error(error);
        }
      };
      void poll();
      const timer = setInterval(() => void poll(), 1_000);
      timer.unref();
      return () => {
        active = false;
        clearInterval(timer);
      };
    });
  }

  private safeEventType(nodeName: string, eventType: string) {
    if (eventType === "run.queued") return "run.queued";
    if (nodeName === "intake") return "run.started";
    if (nodeName.startsWith("tool.")) {
      return eventType === "started" ? "tool.started" : "tool.completed";
    }
    if (nodeName === "specialists") return "specialist.completed";
    if (nodeName === "verifier") {
      return eventType === "rejected" ? "verification.repairing" : "verification.started";
    }
    return "run.status";
  }

  private safeMetadata(value: unknown): Record<string, boolean | null | number | string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, boolean | null | number | string] =>
          ["boolean", "number", "string"].includes(typeof entry[1]) || entry[1] === null,
        )
        .slice(0, 20),
    );
  }

  private terminalEvent(status: string) {
    if (status === "COMPLETED") return "run.completed";
    if (status === "CANCELLED") return "run.cancelled";
    return "run.failed";
  }

  private terminalMessage(status: string) {
    if (status === "COMPLETED") return "Verified evidence response is ready.";
    if (status === "CANCELLED") return "Evidence run cancelled.";
    return "Evidence run ended without a verified response.";
  }
}
