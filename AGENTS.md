# PlanDelta AI — Autonomous Codex Instructions

These instructions apply to the entire repository. Read START_HERE.md, PLAN.md,
PHASES.md, and every file in docs/ before implementing.

## Mission

Build PlanDelta AI into a polished, portfolio-ready construction blueprint
revision analysis product. It must work end to end locally before any AWS phase
begins. After the local release gate passes, deploy the frontend to Vercel and
the cost-controlled containerized backend to AWS.

## Autonomous execution

- Execute PHASES.md in order and continue from one phase to the next without
  asking for routine confirmation.
- Do not stop after scaffolding, a UI mock, or one successful build.
- Update PHASES.md checkboxes and its Current execution state after every
  meaningful milestone so work can resume after context loss.
- When a command fails, diagnose it, fix the underlying cause, rerun the
  smallest relevant check, and continue.
- Make reasonable implementation decisions that remain inside PLAN.md.
- Do not wait for optional polish, external opinions, or routine package
  choices. Choose the simplest production-sensible option.
- Pause only when progress truly requires unavailable external authority or
  secrets. Before pausing, finish every task that does not depend on the
  blocker, document the exact blocker, and leave the repository passing.
- Never fabricate successful migrations, deployments, AI output, test results,
  URLs, or cloud resources.

## External credentials

- Before Phase 0 implementation begins, run the blocking credential preflight
  in docs/CREDENTIALS.md. This is the one required startup pause.
- Ask the user once for every Supabase, AWS, and Vercel prerequisite needed
  across all later phases. Give exact secure setup instructions, then wait for
  confirmation before scaffolding or installing dependencies.
- Ask the user to place secrets in an ignored local environment file and to
  authenticate AWS CLI interactively. Never ask them to paste permanent access
  keys, database passwords, service-role keys, or tokens into chat.
- Verify required variable names and access without printing their values.
- Verify the AWS identity with STS and the configured profile. Verify Supabase
  project/database access at the first safe opportunity before migrations.
- If GitHub authentication already exists, verify it rather than requesting the
  token again.
- Supabase and AWS values must come from environment variables. Never hardcode,
  commit, print, or paste secrets into documentation.
- If the startup credential validation fails, do not begin implementation.
  Explain the exact missing name or failed authentication step without exposing
  values, then wait for the user to correct it.
- Do not echo environment files. Validate only that required variable names are
  present.
- Before every push, run a secret scan and inspect the staged diff.

## Product boundaries

- MVP analyzes one selected page from two blueprint revisions.
- Accepted inputs: PDF, PNG, JPG, and JPEG, with documented size/page limits.
- Results must come from a real deterministic CV/OCR pipeline. Never present
  random boxes or hardcoded output as user-uploaded analysis.
- Include a clearly labelled built-in sample analysis so the product is always
  demonstrable.
- AWS Bedrock enhances summaries later; local analysis must work without it.
- Total available AWS promotional credit is $100. Treat this as a hard project
  constraint, not a target to consume.
- Keep expensive AWS resources only as long as they provide clear portfolio
  value. Follow the spend and teardown gates in docs/DEPLOYMENT.md.
- The public Vercel app must remain useful after EC2 teardown through a clearly
  labelled precomputed sample. Never pretend that stopped live processing is
  available.
- Do not add payments, teams, chat, mobile apps, or unrelated SaaS features.

## Engineering rules

- Use strict TypeScript and typed Python.
- Keep apps separated: Next.js web, NestJS API/worker, FastAPI vision service.
- Share API contracts instead of duplicating untyped payloads.
- Use Supabase PostgreSQL as the system of record and durable job queue.
- Access storage through an interface: local shared volume first, S3 later.
- Keep the vision service stateless.
- Validate all external input at every trust boundary.
- Store normalized image coordinates from 0 to 1 in the database; convert to
  pixels only at rendering or CV boundaries.
- Prefer small modules and explicit names over abstraction for its own sake.
- No TODO placeholders in required flows at a phase gate.
- Do not silently fall back to fake AI or fake analysis.

## UI rules

- Follow docs/DESIGN_SYSTEM.md.
- Build a serious construction intelligence workspace, not a generic dashboard.
- Do not use purple gradients, glowing blobs, excessive glass, pill-heavy
  layouts, giant rounded cards, decorative statistics, or a three-card feature
  row.
- Use one signal-orange product accent. Blueprint comparison colors are
  semantic data colors, not extra brand accents.
- Every interaction needs loading, empty, error, success, disabled, keyboard,
  mobile, and reduced-motion behavior where applicable.

## Verification

- Use the test strategy in docs/TESTING.md.
- A passing typecheck, lint, unit suite, production build, and critical E2E
  smoke test are required before local completion.
- Verify the CV pipeline against committed golden fixtures and record metrics.
- Verify migrations against a clean database, not only an existing one.
- Test the deployed public paths after deployment.

## Git and GitHub

- Repository name: plandelta-ai.
- Initialize Git when needed. Preserve any existing repository and user work.
- Create a public GitHub repository only after the local secret scan and local
  release gate pass. This is a portfolio project.
- Use Conventional Commits and the commit rules in docs/GIT_WORKFLOW.md.
- Make small commits by concern. Never create one giant project commit.
- Never commit a broken build, generated secrets, environment files, local
  uploads, model caches, node_modules, Python virtual environments, or build
  output.
- Push completed, verified commits. Keep README, diagrams, setup instructions,
  API documentation, and screenshots current.

## Definition of done

Done means all required phases in PHASES.md pass, the app is usable from upload
through report, the sample demo works, tests and builds pass, the repository is
documented and clean, the AWS path is genuinely deployed when credentials are
available, and the final handoff includes URLs, commands, architecture,
limitations, measured costs, and verified resource status.
