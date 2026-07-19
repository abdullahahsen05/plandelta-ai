# Start PlanDelta AI v0.2 Here

This file is the entry point for extending the existing stable repository.

## Before implementation

1. Read the v0.2 `AGENTS.md` and every v0.2 planning document.
2. Inspect the repository, `git status`, remotes, tags, latest commits, current CI status, and the
   completed v0.1.0 phase record.
3. Confirm that `v0.1.0` exists and do not rewrite or move it.
4. Confirm the existing Supabase, Vercel, GitHub, and AWS authentication without printing secrets.
5. Confirm the existing AWS runtime and current cost status before changing any resource.
6. Record the actual starting commit and environment state in `PHASES_AGENTIC_V0_2.md`.
7. Create `feat/agentic-v0.2` from current `main` unless the branch or equivalent implementation
   already exists.

Do not repeat the original Phase 0–11 build. Extend the working product.

## Expected existing baseline

The baseline should already contain:

- Next.js analysis workspace and React Konva evidence viewer;
- NestJS API and separate durable worker;
- stateless FastAPI CV/OCR service;
- Supabase PostgreSQL/Auth with RLS;
- private local/S3 storage providers;
- deterministic and bounded Bedrock report providers;
- Vercel and one cost-controlled AWS runtime;
- v0.1.0 CI, tests, release notes, and deployment evidence.

Verify rather than assume this state. If it differs, preserve user work and record the difference
before proceeding.

## Required implementation order

1. Additive data model and shared contracts.
2. Agent service foundation and provider interfaces.
3. Project-document ingestion and hybrid retrieval.
4. Bounded multi-agent workflow and verifier.
5. NestJS conversation API, durable state, and SSE.
6. Evidence Copilot UI and interactive citations.
7. Analysis profiles and engineering-schematic sample.
8. Guardrails, traces, evaluations, quotas, and cost controls.
9. Complete regression/evaluation/repair loop.
10. Deployment, production smoke tests, documentation, release, and handoff.

Continue directly from each completed item and phase into the next. Do not stop after scaffolding,
one working feature, a commit, a push, a passing focused test, local completion, or deployment. Stop
only after the entire v0.2 definition of done passes, except for a genuine external blocker that
makes all remaining safe work impossible.

Commit after coherent meaningful progress and at least once per phase. Split large phases into
reviewable commits by concern; never place several phases or a huge body of unrelated code into one
commit. After committing and pushing a checkpoint, continue immediately.

## Resume protocol

At the start of every Codex session:

1. read `AGENTS.md` and the Current execution state in `PHASES_AGENTIC_V0_2.md`;
2. inspect `git status` and the last ten commits;
3. confirm the current branch and last completed checkpoint;
4. run only the smallest check needed to validate that checkpoint;
5. continue at the first unchecked item.

Never restart completed phases because context was lost.

## Required final behavior

An authenticated reviewer must be able to:

1. open an existing analysis;
2. upload supporting project documents;
3. observe ingestion status;
4. ask a natural-language question;
5. observe bounded progress without internal chain-of-thought;
6. receive an answer with visual and/or document citations;
7. click a visual citation and focus the exact drawing evidence;
8. click a document citation and inspect the authorized source;
9. see conflicting or insufficient evidence called out explicitly;
10. draft, but not automatically send, a structured RFI;
11. repeat the journey with the engineering-schematic sample.

The public sample must remain useful without unlimited live Bedrock access.
