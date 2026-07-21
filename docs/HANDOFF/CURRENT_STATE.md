# Current PlanDelta State

Last updated: 2026-07-22. This file is a handoff ledger and must be refreshed after every deployment
or material operational change. Never carry forward a success claim without re-verifying it.

## Stable baseline

- Public repository: <https://github.com/abdullahahsen05/plandelta-ai>
- Production web: <https://plandelta-ai.vercel.app>
- Preserved releases: `v0.1.0` and `v0.2.0`
- Default branch: `main`
- Current release-record branch: `codex/evidence-release-record` (documentation only)
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

## Release outcome

The evidence-access change is live. PR #21 merged to `main` at `ecac5f4`. Vercel deployed that
merge to production and the `plandelta-ai.vercel.app` alias is attached to the ready deployment.
The AWS service images were intentionally not rebuilt: this diff changes only `apps/web` and
documentation, while the API/agent/vision backend code is byte-for-byte unchanged. The retained
immutable backend runtime passed Phase 9/10 verification and a fresh authenticated production RAG
journey.

Production proof on 2026-07-22:

- a supporting technical note reached `COMPLETED` ingestion;
- the knowledge specialist used local BGE plus hybrid retrieval;
- Bedrock completed the answer with one verified document citation;
- the generated RFI remained review-only;
- all synthetic production records were cleaned up;
- the authenticated Chromium journey selected evidence before project creation, completed real
  drawing analysis, opened the workbench document register, rendered linked evidence/report, and
  cleaned up in 40.3 seconds;
- all nine CloudWatch alarms were `OK` and both AWS control/runtime verifiers passed.

## Final release evidence

Populate after deployment. Unknown values must remain `pending`, never guessed.

| Evidence | Current value |
| --- | --- |
| PR | [#21](https://github.com/abdullahahsen05/plandelta-ai/pull/21) |
| Merge commit | `ecac5f4166eb3bba850b3848484b4cefda7f2bb8` |
| PR / main CI | `29869569858` / `29869702864`, both successful |
| Vercel production deployment | `dpl_7HKA2c1ztHykYUshf8VisaSQiUuN`, Ready |
| Immutable AWS image/runtime commit | `1e41ee4cf38853a4d89abb805f670ef2df5758c7`; unchanged backend images |
| API health/version | `ok` / `0.2.0`; database, agent, and vision all `ok` |
| Production RAG/Copilot smoke | passed: completed ingestion, 1 verified citation, Bedrock, cleanup |
| Production browser smoke | passed in 40.3 seconds |
| CloudWatch alarms | all 9 `OK`; Phase 9 and Phase 10 verifiers passed |
| AWS actual/forecast cost | USD 2.148 actual against USD 25; forecast unavailable, not claimed |

## Known honest limitations

- PlanDelta is construction decision support, not engineering approval or certification.
- Only construction drawings and the verified engineering-schematic profile are supported; this is
  not an arbitrary-image chatbot.
- RAG quality depends on extraction quality, correct revision metadata, and relevant source text.
- A curated regression/evaluation set does not establish field accuracy.
- Live AI synthesis depends on the single EC2 runtime, Supabase, and on-demand Bedrock availability.
- The EC2 public IP can change after restart; automation must refresh certificates/origins.
- Every finding, impact statement, citation, and RFI draft requires qualified human review.
