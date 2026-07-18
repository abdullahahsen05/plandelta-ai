import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BedrockSummaryProvider } from "../src/summary/bedrock-summary.provider.js";
import type { SummaryChange } from "../src/summary/summary.types.js";

const changes: SummaryChange[] = [
  {
    id: "change-one",
    sequence: 1,
    changeType: "ADDED",
    category: "WALL_LINEWORK",
    confidence: 0.84,
    oldText: null,
    newText: "NEW PARTITION",
    affectedTrades: ["architectural", "structural"],
    impact: "Review partition coordination.",
  },
];

function response(sequence = 1) {
  return {
    output: {
      message: {
        role: "assistant",
        content: [
          {
            text: JSON.stringify({
              executiveSummary:
                "One added wall-linework region warrants architectural and structural coordination review.",
              coordinationPriorities: [
                { sequence, reason: "The supplied evidence identifies added partition linework." },
              ],
              riskNotes: ["Confirm the revised partition against the governing source drawing."],
              limitations: ["The summary is limited to supplied deterministic evidence."],
            }),
          },
        ],
      },
    },
    stopReason: "end_turn",
    usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180 },
    metrics: { latencyMs: 10 },
  };
}

describe("BedrockSummaryProvider", () => {
  beforeEach(() => {
    process.env.BEDROCK_MODEL_ID = "provider.model-version";
    process.env.BEDROCK_MAX_OUTPUT_TOKENS = "600";
    process.env.BEDROCK_MAX_INPUT_CHARACTERS = "12000";
    process.env.BEDROCK_TIMEOUT_MS = "15000";
  });

  afterEach(() => {
    delete process.env.BEDROCK_MODEL_ID;
    delete process.env.BEDROCK_MAX_OUTPUT_TOKENS;
    delete process.env.BEDROCK_MAX_INPUT_CHARACTERS;
    delete process.env.BEDROCK_TIMEOUT_MS;
  });

  it("requests strict evidence-only JSON and validates the response", async () => {
    const send = vi.fn<(command: unknown, options?: unknown) => Promise<unknown>>();
    send.mockResolvedValue(response());
    const provider = new BedrockSummaryProvider({ send } as never);

    const summary = await provider.summarizeAnalysis(changes);

    expect(summary).toMatchObject({
      provider: "BEDROCK",
      modelId: "provider.model-version",
      promptVersion: "bedrock-evidence-v1",
    });
    expect(summary.structuredSummary).toMatchObject({
      aiGenerated: true,
      counts: { ADDED: 1 },
    });
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(ConverseCommand);
    if (!(command instanceof ConverseCommand)) throw new Error("Expected ConverseCommand.");
    expect(command.input.outputConfig?.textFormat?.type).toBe("json_schema");
    expect(command.input.inferenceConfig).toMatchObject({ maxTokens: 600, temperature: 0 });
    const systemBlock = command.input.system?.[0];
    const systemText = systemBlock && "text" in systemBlock ? systemBlock.text : undefined;
    expect(systemText).toContain("untrusted quoted data");
    expect(JSON.stringify(command.input.messages)).not.toContain('"image"');
    const options = send.mock.calls[0]?.[1];
    if (!options || typeof options !== "object" || !("abortSignal" in options)) {
      throw new Error("Expected an abort signal.");
    }
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("rejects invented evidence sequence numbers", async () => {
    const send = vi.fn().mockResolvedValue(response(99));
    const provider = new BedrockSummaryProvider({ send } as never);

    await expect(provider.summarizeAnalysis(changes)).rejects.toThrow("unknown evidence sequence");
  });

  it("rejects truncated output instead of presenting partial AI text", async () => {
    const send = vi.fn().mockResolvedValue({ ...response(), stopReason: "max_tokens" });
    const provider = new BedrockSummaryProvider({ send } as never);

    await expect(provider.summarizeAnalysis(changes)).rejects.toThrow("output limit");
  });
});
