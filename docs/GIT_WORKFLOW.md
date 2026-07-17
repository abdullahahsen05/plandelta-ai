# Git and GitHub Workflow

## Repository

- Local and remote name: plandelta-ai
- Default branch: main
- Portfolio visibility: public after secret and license review
- Preserve an existing remote if one already belongs to this project

## Commit format

Use Conventional Commits:

- chore(repo): initialize pnpm workspace
- feat(web): add synchronized blueprint viewer
- feat(api): create revision upload endpoint
- feat(vision): align blueprint revisions
- feat(db): add durable analysis queue
- test(vision): add unchanged-plan golden fixture
- docs(architecture): document job leasing
- fix(worker): recover expired analysis leases

## Commit discipline

- One coherent concern per commit.
- Prefer several small verified commits within a phase.
- Do not mix mass formatting with feature behavior.
- Do not commit code known to fail relevant checks.
- Review git diff and staged diff before every commit.
- Stage explicit files rather than blindly staging the entire workspace when
  unrelated changes exist.
- Never rewrite or discard user commits without explicit direction.

## Branching

For a solo portfolio build, work directly on main only when commits remain
small and verified. If GitHub policy requires pull requests, use short-lived
branches named:

- feat/blueprint-viewer
- feat/vision-alignment
- fix/job-recovery

Do not leave long-running branches with undocumented divergence.

## Before push

1. git status
2. inspect staged diff
3. relevant lint/typecheck/tests
4. production build at phase/release gates
5. secret scan
6. verify .env, uploads, model cache, and generated artifacts are ignored
7. update PHASES.md and documentation

## GitHub repository quality

Required:

- README with live demo, screenshots, architecture, setup, stack, method,
  measured results, limitations, security, and cost notes
- LICENSE selected deliberately
- CHANGELOG.md
- CONTRIBUTING.md
- issue templates for bug and feature
- GitHub Actions with passing checks
- descriptive repository topics
- social preview image
- release tag for the local release candidate and final cloud release

## Commit sizing

There is no rigid line limit, but a commit should be understandable in one
review pass. Generated lockfile changes may be large but should accompany only
the dependency change that produced them. If a commit message needs “and” to
describe unrelated work, split it.

## History safety

- Never commit credentials and then merely delete them later.
- If a secret enters history, stop pushing, rotate it, and clean the history
  with an appropriate documented process.
- Do not force-push shared history unless explicitly authorized and necessary.
