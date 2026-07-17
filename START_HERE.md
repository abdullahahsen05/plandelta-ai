# Start Here

This file is the execution entry point for Codex.

## Required reading order

1. AGENTS.md
2. PLAN.md
3. PHASES.md
4. docs/CREDENTIALS.md
5. docs/ARCHITECTURE.md
6. docs/DATABASE.md
7. docs/API_CONTRACT.md
8. docs/DESIGN_SYSTEM.md
9. docs/TESTING.md
10. docs/SECURITY.md
11. docs/GIT_WORKFLOW.md
12. docs/DEPLOYMENT.md

## Credential preflight — required before building

1. Read docs/CREDENTIALS.md.
2. Ask the user once for all Supabase, AWS, and Vercel setup required by the
   full plan.
3. Give the user the exact ignored local file/profile setup to complete.
4. Wait for the user to confirm the setup is complete.
5. Validate variable presence, AWS STS identity, selected region, GitHub auth,
   Vercel auth, and safe credential-file ignore rules without printing secret
   values.
6. Record the preflight result in PHASES.md.

Do not scaffold applications, install dependencies, initialize cloud resources,
or begin Phase 0 until this checkpoint passes. Never request raw permanent AWS
keys or Supabase secrets in chat.

## First implementation actions

1. Inspect the workspace, Git state, installed runtimes, Docker availability,
   and existing files without deleting user work.
2. Record the actual starting state in PHASES.md.
3. Create or normalize the monorepo described in docs/ARCHITECTURE.md.
4. Ensure every application validates its own environment.
5. Validate Supabase connectivity before applying migrations.
6. Begin Phase 0 and continue autonomously.

## Execution contract

- Work phase by phase without waiting between phases.
- A phase completes only after its exit gate passes.
- Commit after small verified units, not only at the end of a phase.
- If a dependency blocks one task, continue all independent work.
- Keep a working application at every completed phase.
- Never claim deployment or migration success without verifying it.

## Commands to maintain

The finished repository must expose these root commands through pnpm:

- pnpm dev
- pnpm build
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm test:e2e
- pnpm format
- pnpm db:generate
- pnpm db:migrate
- pnpm db:seed
- pnpm docker:up
- pnpm docker:down

If a command is intentionally unavailable before its phase, add it as soon as
the owning app exists. Keep README command documentation synchronized.

## Resume protocol

On every new Codex session:

1. Read AGENTS.md and the Current execution state in PHASES.md.
2. Inspect git status and the last five commits.
3. Run the smallest verification command for the last completed task.
4. Continue at the first unchecked item.

Do not restart completed work unless verification proves it is broken.
