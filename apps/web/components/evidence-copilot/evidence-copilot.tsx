"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  BookOpenText,
  Bot,
  CircleStop,
  Copy,
  FileSearch,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiRequest, PlanDeltaApiError, publicApiUrl } from "../../lib/api/client";
import {
  agentRunSchema,
  citationSourceSchema,
  copilotCapabilitiesSchema,
  conversationListSchema,
  conversationSchema,
  copilotMessageListSchema,
  createMessageResultSchema,
  type CitationSource,
  type CopilotMessage,
  type EvidenceCitation,
} from "../../lib/api/contracts";
import type { SampleChange } from "../../lib/sample-data";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type PanelState =
  | "loading"
  | "ready"
  | "running"
  | "reconnecting"
  | "cancelled"
  | "quota"
  | "offline"
  | "error";

type UiCitation = Pick<
  EvidenceCitation,
  | "id"
  | "displayOrder"
  | "citationType"
  | "label"
  | "detectedChangeId"
  | "pageNumber"
  | "sectionTitle"
  | "excerpt"
>;

type UiRfiDraft = {
  subject: string;
  question: string;
  observedConflictOrChange: string;
  requestedClarification: string;
  impactIfUnresolved: string;
  citationIds: string[];
  disclaimer: string;
};

type UiMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  answerStatus: "verified" | "conflicting_evidence" | "insufficient_evidence" | null;
  confidence: "high" | "medium" | "low" | "insufficient" | null;
  warnings: string[];
  citations: UiCitation[];
  rfiDraft: UiRfiDraft | null;
  sample?: boolean;
};

type SafeEvent = {
  sequence: number;
  type: string;
  status: string;
  message: string;
};

const terminalEvents = new Set(["run.completed", "run.failed", "run.cancelled"]);
const activeStatuses = new Set(["QUEUED", "RUNNING", "VERIFYING"]);

const sampleQuestions = [
  "What changed and which trades should review it?",
  "What is the highest-confidence revision?",
  "Draft an RFI for the changed keynote.",
] as const;

function toUiMessage(message: CopilotMessage): UiMessage | null {
  if (message.role !== "USER" && message.role !== "ASSISTANT") return null;
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    answerStatus: message.answerStatus,
    confidence: message.confidence,
    warnings: message.warnings,
    citations: message.citations,
    rfiDraft: message.rfiDraft,
  };
}

function sampleAnswer(question: string, changes: SampleChange[]): UiMessage {
  const first = changes[0];
  const keynote = changes.find((change) => change.category.toLowerCase().includes("text"));
  if (question.includes("highest-confidence")) {
    return {
      id: "sample-answer-confidence",
      role: "ASSISTANT",
      content: first
        ? `The highest-confidence finding is **${first.title}** at ${Math.round(first.confidence * 100)}%. [1]\n\nReview it with ${first.trades.join(" and ")} before coordination.`
        : "This cached sample contains no change evidence.",
      answerStatus: first ? "verified" : "insufficient_evidence",
      confidence: first ? "high" : "insufficient",
      warnings: ["Sample output from committed fixtures; verify against source drawings."],
      citations: first
        ? [
            {
              id: "sample-citation-confidence",
              displayOrder: 1,
              citationType: "VISUAL_CHANGE",
              label: `Change #${first.sequence}`,
              detectedChangeId: first.id,
              pageNumber: null,
              sectionTitle: null,
              excerpt: null,
            },
          ]
        : [],
      rfiDraft: null,
      sample: true,
    };
  }
  if (question.includes("Draft an RFI")) {
    const target = keynote ?? first;
    return {
      id: "sample-answer-rfi",
      role: "ASSISTANT",
      content: target
        ? `A review-only RFI draft is prepared for **${target.title}**. [1]`
        : "There is not enough sample evidence to prepare an RFI draft.",
      answerStatus: target ? "verified" : "insufficient_evidence",
      confidence: target ? "medium" : "insufficient",
      warnings: ["This draft is not sent and requires human review."],
      citations: target
        ? [
            {
              id: "sample-citation-rfi",
              displayOrder: 1,
              citationType: "VISUAL_CHANGE",
              label: `Change #${target.sequence}`,
              detectedChangeId: target.id,
              pageNumber: null,
              sectionTitle: null,
              excerpt: null,
            },
          ]
        : [],
      rfiDraft: target
        ? {
            subject: `Clarify revised note on drawing A2.14`,
            question: `Please confirm the intended scope associated with “${target.newText ?? target.title}.”`,
            observedConflictOrChange: `${target.oldText ?? "Prior condition"} was revised to ${target.newText ?? target.title}.`,
            requestedClarification:
              "Confirm the governing requirement and identify any coordinated drawing or schedule updates.",
            impactIfUnresolved:
              "Work sequencing and trade coordination may be affected; impact has not been confirmed.",
            citationIds: ["sample-citation-rfi"],
            disclaimer: "Draft — requires human review. PlanDelta does not send RFIs.",
          }
        : null,
      sample: true,
    };
  }
  const cited = changes.slice(0, 3);
  return {
    id: "sample-answer-summary",
    role: "ASSISTANT",
    content:
      cited.length > 0
        ? cited
            .map(
              (change, index) =>
                `${index + 1}. **${change.title}** — review with ${change.trades.join(" and ")}. [${index + 1}]`,
            )
            .join("\n")
        : "This cached sample contains no change evidence.",
    answerStatus: cited.length > 0 ? "verified" : "insufficient_evidence",
    confidence: cited.length > 0 ? "high" : "insufficient",
    warnings: ["Sample output from committed fixtures; verify against source drawings."],
    citations: cited.map((change, index) => ({
      id: `sample-citation-${index + 1}`,
      displayOrder: index + 1,
      citationType: "VISUAL_CHANGE",
      label: `Change #${change.sequence}`,
      detectedChangeId: change.id,
      pageNumber: null,
      sectionTitle: null,
      excerpt: null,
    })),
    rfiDraft: null,
    sample: true,
  };
}

function apiErrorState(error: unknown): { state: PanelState; message: string } {
  if (error instanceof PlanDeltaApiError) {
    if (error.code === "AGENT_RATE_LIMITED" || error.status === 429) {
      return {
        state: "quota",
        message: "Today’s live Evidence Copilot allowance has been reached.",
      };
    }
    if (error.code === "AGENT_CONCURRENCY_LIMIT") {
      return { state: "error", message: "Another evidence run is active. Reconnect or wait." };
    }
    return { state: "error", message: error.message };
  }
  return {
    state: "offline",
    message: "Live Evidence Copilot is unavailable. The drawing review remains usable.",
  };
}

async function readSafeEventStream(
  runId: string,
  token: string,
  afterSequence: number,
  signal: AbortSignal,
  onEvent: (event: SafeEvent) => void,
) {
  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "x-correlation-id": crypto.randomUUID(),
  });
  if (afterSequence > 0) headers.set("last-event-id", String(afterSequence));
  const response = await fetch(publicApiUrl(`/agent-runs/${runId}/events`), {
    headers,
    cache: "no-store",
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`SSE_HTTP_${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  while (!terminal) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const eventType = block
        .split("\n")
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim();
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (!eventType || !data) continue;
      const parsed: unknown = JSON.parse(data);
      if (!parsed || typeof parsed !== "object") continue;
      const record = parsed as Record<string, unknown>;
      if (
        typeof record.sequence !== "number" ||
        typeof record.status !== "string" ||
        typeof record.message !== "string"
      )
        continue;
      const safeEvent = {
        sequence: record.sequence,
        type: eventType,
        status: record.status,
        message: record.message.slice(0, 240),
      };
      onEvent(safeEvent);
      terminal = terminalEvents.has(eventType);
    }
    if (done) break;
  }
  return terminal;
}

function inlineMarkdown(
  value: string,
  citations: UiCitation[],
  onCitation: (citation: UiCitation) => void,
) {
  const tokens = value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g);
  return tokens.map((token, index): ReactNode => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={`${token}-${index}`}>{token.slice(1, -1)}</code>;
    }
    const marker = token.match(/^\[(\d+)]$/);
    if (marker) {
      const citation = citations.find(
        (candidate) => candidate.displayOrder === Number(marker[1]),
      );
      if (citation) {
        return (
          <button
            aria-label={`Open citation ${citation.displayOrder}: ${citation.label}`}
            className="inline-citation"
            key={`${citation.id}-${index}`}
            onClick={() => onCitation(citation)}
            type="button"
          >
            [{citation.displayOrder}]
          </button>
        );
      }
    }
    return token;
  });
}

export function SafeMarkdown({
  content,
  citations,
  onCitation,
}: {
  content: string;
  citations: UiCitation[];
  onCitation: (citation: UiCitation) => void;
}) {
  return (
    <div className="safe-markdown">
      {content.split("\n").map((line, index) => {
        if (!line.trim()) return <br aria-hidden="true" key={`space-${index}`} />;
        const list = line.match(/^(\d+)\.\s+(.+)$/);
        if (list) {
          return (
            <div className="markdown-list-row" key={`line-${index}`}>
              <span>{list[1]}.</span>
              <p>{inlineMarkdown(list[2] ?? "", citations, onCitation)}</p>
            </div>
          );
        }
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div className="markdown-list-row" key={`line-${index}`}>
              <span>—</span>
              <p>{inlineMarkdown(bullet[1] ?? "", citations, onCitation)}</p>
            </div>
          );
        }
        return <p key={`line-${index}`}>{inlineMarkdown(line, citations, onCitation)}</p>;
      })}
    </div>
  );
}

function RfiDraft({ draft }: { draft: UiRfiDraft }) {
  const [value, setValue] = useState(draft);
  const [copied, setCopied] = useState(false);
  const fields = [
    ["subject", "Subject"],
    ["question", "Question"],
    ["observedConflictOrChange", "Observed change or conflict"],
    ["requestedClarification", "Requested clarification"],
    ["impactIfUnresolved", "Potential impact if unresolved"],
  ] as const;
  const copy = async () => {
    const text = fields.map(([key, label]) => `${label}\n${value[key]}`).join("\n\n");
    await navigator.clipboard.writeText(`${text}\n\n${value.disclaimer}`);
    setCopied(true);
  };
  return (
    <section className="rfi-draft" aria-label="Editable RFI draft">
      <div className="rfi-draft-heading">
        <div>
          <span>DRAFT — REQUIRES HUMAN REVIEW</span>
          <h4>Request for information</h4>
        </div>
        <div>
          <button onClick={() => void copy()} type="button">
            <Copy aria-hidden="true" size={13} /> {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={() => window.print()} type="button">
            Print
          </button>
        </div>
      </div>
      {fields.map(([key, label]) => (
        <label key={key}>
          <span>{label}</span>
          {key === "subject" ? (
            <input
              onChange={(event) => setValue({ ...value, [key]: event.target.value })}
              value={value[key]}
            />
          ) : (
            <textarea
              onChange={(event) => setValue({ ...value, [key]: event.target.value })}
              rows={3}
              value={value[key]}
            />
          )}
        </label>
      ))}
      <p>{value.disclaimer}</p>
    </section>
  );
}

export function EvidenceCopilot({
  analysisId,
  changes,
  onSelectChange,
  projectId,
  sample,
}: {
  analysisId?: string | undefined;
  changes: SampleChange[];
  onSelectChange: (changeId: string) => void;
  projectId: string;
  sample: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [wide, setWide] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [panelState, setPanelState] = useState<PanelState>(sample ? "ready" : "loading");
  const [statusText, setStatusText] = useState(
    sample ? "Cached sample questions are ready." : "Opening the evidence record…",
  );
  const [error, setError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [retryRunId, setRetryRunId] = useState<string | null>(null);
  const [source, setSource] = useState<CitationSource | null>(null);
  const [citationNotice, setCitationNotice] = useState("");
  const [liveAvailable, setLiveAvailable] = useState(sample);
  const supabaseRef = useRef(createBrowserSupabaseClient());
  const abortRef = useRef<AbortController | null>(null);
  const lastSequenceRef = useRef(0);
  const messageListRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = useMemo(() => {
    if (sample) return [...sampleQuestions];
    const selected = changes[0];
    return [
      "Summarize the verified changes and affected trades.",
      selected
        ? `What evidence supports change #${selected.sequence}?`
        : "What evidence is available for this analysis?",
      "Are there conflicts or missing evidence that need an RFI?",
    ];
  }, [changes, sample]);

  const accessToken = useCallback(async () => {
    const { data } = await supabaseRef.current.auth.getSession();
    if (!data.session?.access_token) throw new Error("Your session has expired.");
    return data.session.access_token;
  }, []);

  const loadMessages = useCallback(
    async (id: string, token: string) => {
      const persisted = await apiRequest(
        `/conversations/${id}/messages`,
        token,
        copilotMessageListSchema,
      );
      setMessages(persisted.map(toUiMessage).filter((message) => message !== null));
      return persisted;
    },
    [],
  );

  const followRun = useCallback(
    async (runId: string, token: string, currentConversationId: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setActiveRunId(runId);
      setRetryRunId(null);
      setPanelState("running");
      setError(null);
      let completed = false;
      try {
        for (let attempt = 0; attempt < 4 && !completed; attempt += 1) {
          if (attempt > 0) {
            setPanelState("reconnecting");
            setStatusText("Reconnecting to the persisted evidence run…");
          }
          completed = await readSafeEventStream(
            runId,
            token,
            lastSequenceRef.current,
            controller.signal,
            (event) => {
              lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);
              setStatusText(event.message);
              setPanelState(event.type === "run.cancelled" ? "cancelled" : "running");
            },
          );
        }
        if (!completed) throw new Error("STREAM_ENDED");
        const run = await apiRequest(`/agent-runs/${runId}`, token, agentRunSchema);
        await loadMessages(currentConversationId, token);
        setActiveRunId(null);
        if (run.status === "COMPLETED") {
          setPanelState("ready");
          setStatusText("Verified response linked to the evidence record.");
        } else if (run.status === "CANCELLED") {
          setPanelState("cancelled");
          setStatusText("Evidence run cancelled. You can retry it.");
          setRetryRunId(runId);
        } else {
          setPanelState("error");
          setStatusText("The run ended without a verified response.");
          setRetryRunId(runId);
          setError("No answer was published. Retry the bounded evidence run.");
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        const mapped = apiErrorState(caught);
        setPanelState(mapped.state);
        setError(mapped.message);
        setStatusText(mapped.message);
        setRetryRunId(runId);
        setActiveRunId(null);
      }
    },
    [loadMessages],
  );

  useEffect(() => {
    if (sample || !analysisId) return;
    let live = true;
    const initialize = async () => {
      try {
        const token = await accessToken();
        const [capabilities, conversations] = await Promise.all([
          apiRequest(
            "/agent-runs/capabilities",
            token,
            copilotCapabilitiesSchema,
          ).catch(() => ({ available: false, provider: "offline" as const })),
          apiRequest(
            `/projects/${projectId}/conversations`,
            token,
            conversationListSchema,
          ),
        ]);
        setLiveAvailable(capabilities.available);
        const conversation = conversations.find(
          (candidate) => candidate.analysisId === analysisId && candidate.status === "ACTIVE",
        );
        if (!conversation) {
          setPanelState(capabilities.available ? "ready" : "offline");
          setStatusText(
            capabilities.available
              ? "Ready to inspect this analysis and its project documents."
              : "Live model compute is offline. Existing evidence history remains available.",
          );
          return;
        }
        if (!live) return;
        setConversationId(conversation.id);
        const persisted = await loadMessages(conversation.id, token);
        const latestActiveRun = persisted
          .flatMap((message) => message.requestedRuns ?? [])
          .find((run) => activeStatuses.has(run.status));
        const latestRetryableRun = persisted
          .flatMap((message) => message.requestedRuns ?? [])
          .find((run) => ["FAILED", "CANCELLED", "EXPIRED"].includes(run.status));
        if (latestActiveRun && capabilities.available) {
          setStatusText("Reconnecting to the persisted evidence run…");
          void followRun(latestActiveRun.id, token, conversation.id);
        } else {
          setPanelState(capabilities.available ? "ready" : "offline");
          setStatusText(
            capabilities.available
              ? "Ready to inspect this analysis and its project documents."
              : "Live model compute is offline. Existing evidence history remains available.",
          );
          setRetryRunId(latestRetryableRun?.id ?? null);
        }
      } catch (caught) {
        if (!live) return;
        const mapped = apiErrorState(caught);
        setPanelState(mapped.state);
        setError(mapped.message);
        setStatusText(mapped.message);
      }
    };
    void initialize();
    return () => {
      live = false;
      abortRef.current?.abort();
    };
  }, [accessToken, analysisId, followRun, loadMessages, projectId, sample]);

  useEffect(() => {
    messageListRef.current?.scrollTo?.({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, panelState]);

  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = question.trim();
    if (!content || panelState === "running" || panelState === "reconnecting") return;
    setQuestion("");
    if (sample) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "USER",
          content,
          answerStatus: null,
          confidence: null,
          warnings: [],
          citations: [],
          rfiDraft: null,
          sample: true,
        },
        sampleAnswer(content, changes),
      ]);
      setPanelState("ready");
      setStatusText("Showing versioned sample output. No live model was called.");
      return;
    }
    try {
      const token = await accessToken();
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        if (!analysisId) throw new Error("ANALYSIS_NOT_SELECTED");
        const createdConversation = await apiRequest(
          `/projects/${projectId}/conversations`,
          token,
          conversationSchema,
          {
            method: "POST",
            body: JSON.stringify({
              analysisId,
              title: "Revision evidence review",
            }),
          },
        );
        currentConversationId = createdConversation.id;
        setConversationId(createdConversation.id);
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "USER",
          content,
          answerStatus: null,
          confidence: null,
          warnings: [],
          citations: [],
          rfiDraft: null,
        },
      ]);
      const created = await apiRequest(
        `/conversations/${currentConversationId}/messages`,
        token,
        createMessageResultSchema,
        {
          method: "POST",
          body: JSON.stringify({ content, idempotencyKey: crypto.randomUUID() }),
        },
      );
      if (!created.runId) throw new Error("RUN_NOT_CREATED");
      lastSequenceRef.current = 0;
      await followRun(created.runId, token, currentConversationId);
    } catch (caught) {
      const mapped = apiErrorState(caught);
      setPanelState(mapped.state);
      setError(mapped.message);
      setStatusText(mapped.message);
    }
  };

  const cancel = async () => {
    if (!activeRunId) return;
    try {
      const token = await accessToken();
      await apiRequest(`/agent-runs/${activeRunId}/cancel`, token, agentRunSchema, {
        method: "POST",
      });
      setStatusText("Cancellation requested. Waiting for the durable run to stop safely…");
    } catch (caught) {
      const mapped = apiErrorState(caught);
      setError(mapped.message);
    }
  };

  const retry = async () => {
    if (!retryRunId || !conversationId) return;
    try {
      const token = await accessToken();
      const run = await apiRequest(`/agent-runs/${retryRunId}/retry`, token, agentRunSchema, {
        method: "POST",
      });
      lastSequenceRef.current = 0;
      await followRun(run.id, token, conversationId);
    } catch (caught) {
      const mapped = apiErrorState(caught);
      setPanelState(mapped.state);
      setError(mapped.message);
    }
  };

  const openCitation = async (citation: UiCitation) => {
    if (citation.citationType === "VISUAL_CHANGE" && citation.detectedChangeId) {
      onSelectChange(citation.detectedChangeId);
      setCitationNotice(`${citation.label} selected in the drawing and change ledger.`);
      return;
    }
    if (sample) return;
    try {
      const token = await accessToken();
      const resolved = await apiRequest(
        `/citations/${citation.id}/source`,
        token,
        citationSourceSchema,
      );
      if (resolved.type === "visual_change" && resolved.changeId) {
        onSelectChange(resolved.changeId);
        setCitationNotice(`${citation.label} selected in the drawing and change ledger.`);
      } else {
        setSource(resolved);
      }
    } catch (caught) {
      setCitationNotice(apiErrorState(caught).message);
    }
  };

  if (collapsed) {
    return (
      <aside className="copilot-collapsed" aria-label="Evidence Copilot collapsed">
        <button onClick={() => setCollapsed(false)} type="button">
          <PanelRightOpen aria-hidden="true" size={17} />
          <span>Evidence Copilot</span>
        </button>
      </aside>
    );
  }

  const running = panelState === "running" || panelState === "reconnecting";
  return (
    <aside
      className={`evidence-copilot ${wide ? "evidence-copilot-wide" : ""}`}
      aria-label="Evidence Copilot"
    >
      <header className="copilot-heading">
        <div>
          <span className="copilot-kicker">
            <Bot aria-hidden="true" size={13} /> EVIDENCE COPILOT
          </span>
          <h2>Ask the project record</h2>
        </div>
        <div className="copilot-panel-controls">
          <button
            aria-label={wide ? "Use standard Copilot width" : "Widen Copilot panel"}
            onClick={() => setWide((value) => !value)}
            type="button"
          >
            {wide ? <Minimize2 aria-hidden="true" size={15} /> : <Maximize2 aria-hidden="true" size={15} />}
          </button>
          <button aria-label="Collapse Evidence Copilot" onClick={() => setCollapsed(true)} type="button">
            <PanelRightClose aria-hidden="true" size={15} />
          </button>
        </div>
      </header>

      <div
        className={`copilot-truth-band ${
          sample ? "sample" : liveAvailable ? "live" : "offline"
        }`}
      >
        <span>
          {sample
            ? "CACHED SAMPLE OUTPUT"
            : liveAvailable
              ? "AUTHENTICATED LIVE COMPUTE"
              : "LIVE MODEL COMPUTE OFFLINE"}
        </span>
        <p>
          {sample
            ? "Questions use committed, versioned answers. No live model is called."
            : liveAvailable
              ? "Answers are bounded to this analysis and its authorized project documents."
              : "Comparison, citations, and prior responses remain available without model calls."}
        </p>
      </div>

      <div className="copilot-status" aria-live="polite" role="status">
        {running || panelState === "loading" ? (
          <LoaderCircle aria-hidden="true" className="copilot-spinner" size={15} />
        ) : panelState === "ready" ? (
          <Sparkles aria-hidden="true" size={15} />
        ) : (
          <AlertTriangle aria-hidden="true" size={15} />
        )}
        <span>{statusText}</span>
      </div>

      <div className="copilot-messages" ref={messageListRef}>
        {messages.length === 0 ? (
          <section className="copilot-empty">
            <FileSearch aria-hidden="true" size={22} />
            <h3>{sample ? "Explore the sample evidence" : "Start with the visible evidence"}</h3>
            <p>
              {sample
                ? "Choose a prepared question to see how answers connect back to the drawing."
                : "Ask about changes, affected trades, document conflicts, or a review-only RFI draft."}
            </p>
          </section>
        ) : (
          messages.map((message) => (
            <article
              className={`copilot-message ${message.role.toLowerCase()}`}
              key={message.id}
            >
              <div className="message-meta">
                <span>{message.role === "USER" ? "YOU" : "EVIDENCE RESPONSE"}</span>
                {message.sample ? <b>SAMPLE OUTPUT</b> : null}
                {message.answerStatus ? (
                  <b className={`answer-status ${message.answerStatus}`}>
                    {message.answerStatus.replaceAll("_", " ")}
                  </b>
                ) : null}
              </div>
              <SafeMarkdown
                citations={message.citations}
                content={message.content}
                onCitation={(citation) => void openCitation(citation)}
              />
              {message.citations.length > 0 ? (
                <div className="citation-tape" aria-label="Verified citations">
                  {message.citations.map((citation) => (
                    <button
                      key={citation.id}
                      onClick={() => void openCitation(citation)}
                      type="button"
                    >
                      <span>{String(citation.displayOrder).padStart(2, "0")}</span>
                      {citation.citationType === "VISUAL_CHANGE" ? (
                        <ArrowDownToLine aria-hidden="true" size={13} />
                      ) : (
                        <BookOpenText aria-hidden="true" size={13} />
                      )}
                      <strong>{citation.label}</strong>
                      <small>
                        {citation.citationType === "VISUAL_CHANGE"
                          ? "Show on drawing"
                          : `Open source${citation.pageNumber ? ` · p.${citation.pageNumber}` : ""}`}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}
              {message.warnings.map((warning) => (
                <p className="answer-warning" key={warning}>
                  <AlertTriangle aria-hidden="true" size={12} /> {warning}
                </p>
              ))}
              {message.rfiDraft ? <RfiDraft draft={message.rfiDraft} /> : null}
            </article>
          ))
        )}
        {running ? (
          <div className="active-run-strip">
            <span />
            <p>{statusText}</p>
            <button onClick={() => void cancel()} type="button">
              <CircleStop aria-hidden="true" size={13} /> Cancel
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="copilot-error">
            <AlertTriangle aria-hidden="true" size={15} />
            <p>{error}</p>
            {retryRunId && panelState !== "quota" ? (
              <button onClick={() => void retry()} type="button">
                <RefreshCw aria-hidden="true" size={13} /> Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="suggested-questions" aria-label="Suggested evidence questions">
        {suggestedQuestions.map((suggestion) => (
          <button
            disabled={running || (!sample && panelState !== "ready" && panelState !== "cancelled")}
            key={suggestion}
            onClick={() => setQuestion(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form className="copilot-composer" onSubmit={(event) => void ask(event)}>
        <label htmlFor="copilot-question">Question for the evidence record</label>
        <div>
          <textarea
            disabled={running || panelState === "loading" || panelState === "quota" || panelState === "offline"}
            id="copilot-question"
            maxLength={4000}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              sample
                ? "Choose a cached question above"
                : "Ask what changed, why it matters, or what evidence is missing"
            }
            rows={3}
            value={question}
          />
          <button
            aria-label="Ask Evidence Copilot"
            disabled={!question.trim() || running || panelState === "loading" || panelState === "quota" || panelState === "offline"}
            type="submit"
          >
            <Send aria-hidden="true" size={16} />
          </button>
        </div>
        <p>Decision support only. Verify every cited source before action.</p>
      </form>

      <span className="sr-only" aria-live="polite">
        {citationNotice}
      </span>

      {source?.type === "document_chunk" ? (
        <div className="source-preview-backdrop" role="presentation">
          <section
            aria-label={`Source preview for ${source.documentName}`}
            aria-modal="true"
            className="source-preview"
            role="dialog"
          >
            <header>
              <div>
                <span>AUTHORIZED SOURCE EXCERPT</span>
                <h3>{source.documentName}</h3>
              </div>
              <button aria-label="Close source preview" onClick={() => setSource(null)} type="button">
                <X aria-hidden="true" size={16} />
              </button>
            </header>
            <dl>
              <div>
                <dt>Revision</dt>
                <dd>{source.revisionLabel ?? "Current active version"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {source.page ? `Page ${source.page}` : "Page unavailable"}
                  {source.section ? ` · ${source.section}` : ""}
                </dd>
              </div>
            </dl>
            <blockquote>{source.excerpt ?? "A bounded source preview is unavailable."}</blockquote>
            <p>
              This exact excerpt is shown because a page-render preview is unavailable in the
              current document pipeline.
            </p>
            <button className="source-preview-close" onClick={() => setSource(null)} type="button">
              Return to evidence
            </button>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
