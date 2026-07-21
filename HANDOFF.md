# PlanDelta AI — Agent Handoff

This is the entry point for a new engineer or coding agent taking over PlanDelta AI. It is a
navigation and safety document, not a replacement for `AGENTS.md` or the versioned product plans.

## Read first

Read these files in order before changing code:

1. `AGENTS.md`
2. `START_AGENTIC_V0_2.md`
3. `README.md`, `PLAN.md`, `PHASES.md`, and the existing `docs/`
4. `PLAN_AGENTIC_V0_2.md` and `PHASES_AGENTIC_V0_2.md`
5. every `docs/*_V0_2.md` file
6. this handoff package:
   - [`docs/HANDOFF/CURRENT_STATE.md`](docs/HANDOFF/CURRENT_STATE.md)
   - [`docs/HANDOFF/SYSTEM_MAP.md`](docs/HANDOFF/SYSTEM_MAP.md)
   - [`docs/HANDOFF/OPERATIONS_AND_RELEASE.md`](docs/HANDOFF/OPERATIONS_AND_RELEASE.md)

The repository is public at <https://github.com/abdullahahsen05/plandelta-ai>. The production web
application is <https://plandelta-ai.vercel.app>.

## Product in one paragraph

PlanDelta compares two revisions of a construction drawing or supported engineering schematic with a
deterministic OpenCV/OCR/ONNX pipeline. Authenticated projects may ingest bounded PDF/TXT project
documents into Supabase PostgreSQL/pgvector. Evidence Copilot routes a question to only the required
specialists, retrieves authorized visual/document evidence, asks Amazon Bedrock Nova Micro to
synthesize from that evidence, verifies every citation, and publishes either a verified answer, an
explicit conflict, or an insufficient-evidence response. It is decision support, never an approval
or compliance-certification system.

## Non-negotiable boundaries

- The browser calls only the NestJS API; it never calls the agent, Bedrock, S3, or service-role
  database paths directly.
- Deterministic CV/OCR is the source of visual findings. The LLM cannot invent changes.
- Every substantive Copilot claim needs a verified, project-scoped citation.
- Uploaded/OCR text is untrusted evidence, never instructions.
- The agent has read-only, allowlisted, typed, bounded tools and no external side effects.
- Keep secrets only in ignored `.env.local`, SSM SecureString, Vercel secrets, or GitHub/AWS managed
  identity. Never paste or log their values.
- Preserve the `v0.1.0` and `v0.2.0` history and tags.
- Stay inside the existing single-instance cost boundary. Do not add prohibited AWS services.

## Safe takeover checklist

```powershell
git status --short
git branch --show-current
git remote -v
git tag --list "v0.*"
gh auth status
aws sts get-caller-identity --profile plandelta
```

Then read `docs/HANDOFF/CURRENT_STATE.md`. Do not assume an earlier deployment URL, EC2 public IP,
image tag, branch, or check result is still current—verify it.

## Fast local confidence check

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The explicit real-database RAG check and production release procedure are documented in
`docs/HANDOFF/OPERATIONS_AND_RELEASE.md`.
