# Chat, Knowledge, and Agent API Contract v0.2

Follow the existing `/v1` conventions, authentication middleware, DTO
validation, ownership enforcement, pagination, correlation IDs, and error
shape. Route names may be adjusted for repository conventions.

## Public NestJS endpoints

### Knowledge documents

- `POST /v1/projects/:projectId/knowledge-documents`
- `GET /v1/projects/:projectId/knowledge-documents`
- `GET /v1/projects/:projectId/knowledge-documents/:documentId`
- `POST /v1/projects/:projectId/knowledge-documents/:documentId/retry`
- `DELETE /v1/projects/:projectId/knowledge-documents/:documentId`
- `GET /v1/projects/:projectId/knowledge-documents/:documentId/source`

Uploads use the existing safe multipart/storage behavior. Status responses do
not expose storage keys or parser internals.

### Conversations and runs

- `POST /v1/projects/:projectId/conversations`
- `GET /v1/projects/:projectId/conversations`
- `GET /v1/conversations/:conversationId`
- `DELETE /v1/conversations/:conversationId`
- `POST /v1/conversations/:conversationId/messages`
- `GET /v1/conversations/:conversationId/messages`
- `GET /v1/agent-runs/:runId`
- `POST /v1/agent-runs/:runId/retry`
- `POST /v1/agent-runs/:runId/cancel`
- `GET /v1/agent-runs/:runId/events`

Creating a user message requires a client-generated idempotency key. The
response returns the persisted message and agent run IDs.

### Citations

- `GET /v1/messages/:messageId/citations`
- `GET /v1/citations/:citationId/source`

The source route reauthorizes every request and returns either an existing
artifact route/reference or a bounded document preview/excerpt. It never trusts
the citation ID alone.

## SSE events

Allowed user-visible event types:

- `run.queued`
- `run.started`
- `run.status`
- `specialist.started`
- `specialist.completed`
- `tool.started`
- `tool.completed`
- `verification.started`
- `verification.repairing`
- `run.completed`
- `run.failed`
- `run.cancelled`
- `heartbeat`

Events include IDs, safe status text, sequence number, timestamps, and bounded
metadata. They do not include prompts, chain-of-thought, raw tool arguments,
raw retrieved chunks, OCR contents, signed URLs, or tokens.

## Final answer shape

```json
{
  "messageId": "uuid",
  "runId": "uuid",
  "status": "verified",
  "answerMarkdown": "...",
  "confidence": "high|medium|low|insufficient",
  "warnings": [],
  "citations": [
    {
      "id": "uuid",
      "label": "Change #4",
      "type": "visual_change",
      "target": {
        "analysisId": "uuid",
        "changeId": "uuid"
      }
    }
  ],
  "rfiDraft": null,
  "provider": "bedrock",
  "modelId": "configured-id",
  "promptVersion": "agent-v1"
}
```

The verifier maps in-text citation markers to persisted citation objects. The
client never renders model-provided URLs.

## Internal agent endpoint

NestJS may invoke an internal endpoint such as:

- `POST /internal/v1/agent-runs/:runId/execute`
- `POST /internal/v1/ingestion-jobs/:jobId/execute`
- `GET /internal/v1/health`
- `GET /internal/v1/ready`

Requests carry a service-generated correlation ID and internal authentication.
The agent service loads server-authorized run context by IDs; it does not accept
browser JWTs or LLM-selected ownership fields.

## Error codes

Define stable safe codes including:

- `KNOWLEDGE_DOCUMENT_UNSUPPORTED`
- `KNOWLEDGE_EXTRACTION_FAILED`
- `KNOWLEDGE_EMBEDDING_FAILED`
- `AGENT_CONTEXT_NOT_READY`
- `AGENT_RATE_LIMITED`
- `AGENT_BUDGET_EXCEEDED`
- `AGENT_CANCELLED`
- `AGENT_TIMEOUT`
- `AGENT_MODEL_UNAVAILABLE`
- `AGENT_TOOL_FAILED`
- `AGENT_CITATION_INVALID`
- `AGENT_INSUFFICIENT_EVIDENCE`
- `AGENT_CONFLICTING_EVIDENCE`

Do not return provider exception text or private document content in public
errors.

## Quotas and defaults

All values are configurable. Begin conservatively:

- one active agent run per user;
- one agent worker on AWS;
- maximum 20 live questions per user per day;
- maximum 8 model turns including specialists and verifier;
- maximum 12 tool calls;
- maximum 12 final retrieved chunks;
- maximum one verifier repair;
- maximum 60 seconds per live run unless measured behavior justifies a bounded
  change;
- per-run and daily estimated Bedrock cost ceilings;
- no unlimited unauthenticated live chat.

Record actual measured latency and adjust only with evidence.
