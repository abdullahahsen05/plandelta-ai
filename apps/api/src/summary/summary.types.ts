export type SummaryChange = {
  id: string;
  sequence: number;
  changeType: string;
  category: string;
  confidence: number;
  oldText: string | null;
  newText: string | null;
  affectedTrades: string[];
  impact: string | null;
};

export type GeneratedSummary = {
  executiveSummary: string;
  structuredSummary: Record<string, unknown>;
  provider: "DETERMINISTIC" | "BEDROCK";
  modelId: string | null;
  promptVersion: string;
  warning?: string;
};

export interface SummaryProvider {
  summarizeAnalysis(changes: SummaryChange[]): Promise<GeneratedSummary>;
}

export const SUMMARY_PROVIDER = Symbol("SUMMARY_PROVIDER");
