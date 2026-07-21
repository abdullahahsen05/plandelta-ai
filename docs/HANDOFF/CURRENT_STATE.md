# Current PlanDelta State

Last updated: 2026-07-22. This file is a handoff ledger and must be refreshed after every deployment
or material operational change. Never carry forward a success claim without re-verifying it.

## Stable baseline

- Public repository: <https://github.com/abdullahahsen05/plandelta-ai>
- Production web: <https://plandelta-ai.vercel.app>
- Preserved releases: `v0.1.0` and `v0.2.0`
- Default branch: `main`
- Current implementation branch: `codex/project-evidence-access`
- AWS region/profile: `us-east-1` / `plandelta`
- Cost boundary: USD 25 target, USD 100 promotional-credit ceiling

## Current change

The in-progress delivery makes project evidence first-class throughout the product:

- the comparison creation page accepts up to eight PDF/TXT supporting documents before a project
  or analysis exists;
- selected documents are validated and queued for ingestion before drawing revisions are uploaded;
- partial setup failures clean up created documents/revisions/project where possible;
- the live workbench toolbar has `Upload evidence` and `Review documents` actions beside the view
  selector;
- the workbench drawer reuses the project evidence register with truthful ingestion readiness,
  retry, versioning, deletion, and source review;
- the Next.js source proxy preserves authentication and does not expose service credentials or S3;
- the authenticated browser journey now covers pre-analysis evidence selection and workbench review.

Implementation commit: `c1acf45` (`feat(web): surface project evidence across comparison workflows`).

## Verification completed on this branch

- Web strict typecheck: passed.
- Web lint: passed.
- Web unit/component suite: 19/19 passed.
- Next.js production build: passed and includes the authenticated evidence-source route.
- New evidence component tests: 4 focused tests passed.
- Agent service suite: 66 passed; the separately enabled database integration is intentionally
  skipped in the default suite.
- Explicit real Supabase RAG integration: passed. It performed extraction, local BGE embeddings,
  hybrid retrieval, active-version replacement, stale-conflict retrieval, and cleanup.
- Desktop visual check: passed.
- Mobile 390×844 visual check: passed with no horizontal overflow.

## Still required before calling this change live

- comprehensive handoff documents committed;
- full repository/static/security checks appropriate to the diff;
- reviewed branch pushed and CI green;
- PR merged to `main`;
- Vercel production `Ready` on the merge commit;
- AWS runtime refreshed to the merge commit and Phase 9/10 verified;
- authenticated production evidence upload/ingestion/Copilot answer with verified document citation
  and source review;
- production browser confirmation of the new toolbar/drawer and creation-page upload;
- final commit/deployment/resource/cost evidence recorded below.

## Final release evidence

Populate after deployment. Unknown values must remain `pending`, never guessed.

| Evidence | Current value |
| --- | --- |
| PR | pending |
| Merge commit | pending |
| CI run | pending |
| Vercel production deployment | pending |
| Immutable AWS image/runtime commit | pending |
| API health/version | pending |
| Production RAG/Copilot smoke | pending |
| Production browser smoke | pending |
| CloudWatch alarms | pending |
| AWS actual/forecast cost | pending |

## Known honest limitations

- PlanDelta is construction decision support, not engineering approval or certification.
- Only construction drawings and the verified engineering-schematic profile are supported; this is
  not an arbitrary-image chatbot.
- RAG quality depends on extraction quality, correct revision metadata, and relevant source text.
- A curated regression/evaluation set does not establish field accuracy.
- Live AI synthesis depends on the single EC2 runtime, Supabase, and on-demand Bedrock availability.
- The EC2 public IP can change after restart; automation must refresh certificates/origins.
- Every finding, impact statement, citation, and RFI draft requires qualified human review.

