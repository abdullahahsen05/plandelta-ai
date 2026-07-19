# Evidence Copilot UX v0.2

## Placement

Place the copilot in the existing analysis workspace as a resizable/collapsible
panel. It complements the change ledger and drawing viewer; it does not replace
them. On small screens, use a dedicated sheet/page with a clear return to the
selected evidence.

## Core states

- No analysis selected.
- Analysis processing.
- Analysis ready without knowledge documents.
- Documents ingesting.
- Ready with suggested questions.
- User message queued/running.
- Specialist/tool progress using safe status labels.
- Streaming reconnect.
- Verified answer.
- Conflicting evidence.
- Insufficient evidence.
- Rate/cost limit reached.
- Cancelled, retryable error, permanent error, and compute offline.

Never show fake “thinking” text or chain-of-thought. Show factual status such as
“Searching project specifications” or “Verifying 3 citations.”

## Citation interactions

### Visual citation

- Shows a stable label such as `Change #4` and category.
- Selecting it focuses the existing canvas region, ledger item, and evidence
  details.
- Preserves current zoom when reasonable; offers fit-to-evidence.
- Announces selection for screen readers.

### Document citation

- Shows document name, revision, page, and section.
- Opens an authorized preview at the cited page when supported.
- Otherwise shows a bounded exact excerpt plus metadata.
- Indicates older/stale/conflicting revision status visibly.

No model-generated link is rendered as a trusted navigation target.

## RFI draft

Render a structured draft containing:

- subject;
- question;
- observed conflict/change;
- cited references;
- requested clarification;
- impact if unresolved, explicitly qualified;
- disclaimer and `Draft — requires human review` state.

Allow copy/print only. Do not send externally in v0.2.

## Public sample

- Keep the existing construction sample.
- Add one engineering-schematic sample.
- Offer a small set of cached questions with precomputed, versioned answers and
  citations.
- Label cached answers as sample output.
- Do not accept arbitrary unauthenticated questions that invoke Bedrock.
- If live compute is offline, authentication/live actions must communicate the
  truthful state while both cached samples remain usable.

## Accessibility and safety

- Keyboard-operable panel, message list, composer, citations, preview, and
  collapse/resize controls.
- Visible focus, appropriate live regions, and non-spammy status announcements.
- Reduced-motion support and no typing animation requirement.
- Sanitize Markdown and disallow raw HTML/scripts.
- Preserve long identifiers and citations without overflow.
- Disable duplicate submit while a run is active unless cancellation completes.
