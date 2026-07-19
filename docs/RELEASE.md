# Release evidence

## v0.2 local release candidate

The complete v0.2 local verification and repair loop passed on 2026-07-19 against feature revision
`5e8a5b4f8664f23e3d9c08904693c19d9bbcf2ee`. The run included clean migration replay,
idempotent seeds, RLS and durable queue behavior, static gates, all unit/service suites, explicit
Supabase RAG and AWS provider integrations, all production builds and images, browser E2E, and the
30-case frozen evaluation.

Two real disposable journeys passed and cleaned up:

- construction drawings uploaded through the deterministic CV/OCR/ONNX worker to linked evidence
  and a printable report;
- an engineering-schematic technical note ingested through local BGE embeddings and hybrid search
  to a Bedrock-grounded answer, verified document citation, and review-only RFI draft.

Normal suites passed 66 agent tests plus the separately enabled real RAG test, 56 API tests plus the
two separately enabled AWS tests, 32 vision tests, 15 web tests, and 8 contract tests. All seven
browser cases passed when the authenticated live case was enabled. The normal opt-in skips therefore
do not represent skipped release requirements.

`pnpm audit` and `pip-audit` found no published dependency vulnerability. Docker Scout found no
fixable high/critical image issue; the three vendor-unfixed Debian Perl findings recorded below
remain accepted and monitored. The images run non-root, the browser bundle contains none of the
checked server-only variable names, and the full-history secret scan is required immediately before
each push.

## v0.2 production release evidence

The production candidate was verified on 2026-07-19:

- Annotated release
  [`v0.2.0`](https://github.com/abdullahahsen05/plandelta-ai/releases/tag/v0.2.0) was published from
  commit `82156213f058bfdb4de287357083d1a14fd01b81` after
  [`main` CI run `29697277667`](https://github.com/abdullahahsen05/plandelta-ai/actions/runs/29697277667)
  passed.
- Final branch CI
  [`29697136227`](https://github.com/abdullahahsen05/plandelta-ai/actions/runs/29697136227)
  passed every required job, and reviewed
  [PR #15](https://github.com/abdullahahsen05/plandelta-ai/pull/15) merged to `main` as
  `ba9d1138dec87e347cc2c6a418809685fc874a08`.
- Vercel production and alias are Ready at
  [`https://plandelta-ai.vercel.app`](https://plandelta-ai.vercel.app).
- AWS Phase 9 and Phase 10 verifiers passed at `https://100.58.166.134` after a forced EC2 restart.
  The deployment refresh downloaded the exact Git revision, restored the immutable Compose bundle,
  detected the changed public IP, issued a new short-lived IP certificate, and brought all five
  services back healthy.
- Agent, API, and vision ECR repositories contain immutable image tag
  `70c02f0dab5bb6282c7134e19a2d33323a940fa1`.
- Production has all 12 migrations. The production database behavior check passed cross-user RLS,
  analysis/ingestion/agent leases, stale recovery, hybrid conflicts, and project knowledge scope.
- A disposable production supporting-document journey completed local BGE embedding, pgvector/full-
  text retrieval, on-demand Nova Micro synthesis, one verified citation, a review-only RFI, and
  cleanup.
- A disposable final-image production browser journey completed authentication, two drawing
  uploads, durable CV/OCR/ONNX analysis, linked evidence and crop, printable report, and cleanup in
  46.5 seconds.
- Real-browser public checks passed for both labelled samples, mobile layout, cached cited response,
  citation-to-ledger focus, and no console warnings/errors.
- All nine CloudWatch alarms were `OK`. Log streams were present for API, worker, agent, vision, and
  proxy.

The retained `t3.small` did not require resizing. After deployment it had 1,913 MB total memory,
843 MB used, 885 MB available, and only 2.8 MB of 2 GB swap used. The agent used approximately
87 MB idle. The encrypted 20 GB gp3 root volume was 49% used.

AWS Budgets reported USD 0.589 actual against the USD 25 teardown gate. Cost Explorer remained
lagged and returned effectively zero unblended cost; AWS rejected the forecast request with
`DataUnavailableException` because there was insufficient history. No forecast is claimed. Gross
USD 10/15/20/25 alerts and the teardown gate remain binding.

One interrupted browser smoke test created a disposable synthetic identity before local network
access to Supabase timed out. The smallest journey rerun passed. A direct scoped cleanup removed
that identity plus four older `plandelta-playwright-…@example.invalid` test projects/users and their
private S3 objects; no non-synthetic owner was in scope.

## Preserved v0.1 release evidence

This record began with the local `v0.1.0-rc.1` candidate and now includes the
verified Vercel production deployment and AWS runtime evidence captured on
2026-07-18. Passwordless authentication, live uploads, deterministic analysis,
and report generation have passed as one public production journey. Annotated
stable release [`v0.1.0`](https://github.com/abdullahahsen05/plandelta-ai/releases/tag/v0.1.0)
was published from release commit `11bdca3` after all six CI jobs passed.

## Local release gate

| Verification | Result |
| --- | --- |
| `pnpm format:check` | Passed |
| `pnpm lint` | Passed across all TypeScript and Python workspaces |
| `pnpm typecheck` | Passed with strict TypeScript and typed Python |
| `pnpm test` | 3 contract, 9 web, 41 API, and 27 vision tests passed |
| `pnpm test:e2e` | Contract, API, vision, browser, authenticated local, and deployed service-boundary checks passed |
| `pnpm build` | Contracts, UI, API, web, and vision production builds passed |
| Fresh-clone rehearsal | Install, Prisma generation, format, lint, typecheck, unit tests, E2E, and production builds passed from the committed candidate |
| Authenticated Compose journey | Upload, durable queue, worker, real vision processing, evidence, artifacts, and deterministic report completed |

The responsive browser gate covers a 390 x 844 viewport and reduced motion with
no horizontal overflow. Desktop screenshots and the side-by-side comparison
were visually reviewed before inclusion in the README.

## Container evidence

| Image | Runtime identity | Docker Scout size | Readiness |
| --- | --- | ---: | --- |
| API and worker | `node`, UID 1000 | 243 MB | API database and vision readiness passed |
| Vision | `plandelta`, UID 999 | 560 MB | Vision readiness passed |

Compose was verified with one worker and concurrency one. The API runtime
contains compiled production code and production dependencies only; source
trees, test runners, npm, and npx are absent. Both writable `/data` paths are
owned by their unprivileged service user.

## Security review

- `pnpm audit --audit-level moderate`: no known vulnerabilities.
- `pip-audit`: no known vulnerabilities in resolved Python dependencies; the
  local editable `plandelta-vision` package is not published on PyPI and was
  therefore skipped as a package name.
- Docker Scout: no application dependency finding remains at high or critical
  severity.
- Request validation, bounded uploads/pages/pixels, timeouts, traffic limits,
  database-backed user quotas, redacted logs, private artifacts, and safe error
  responses were exercised by unit or integration checks.

Docker Scout reports the same vendor-unfixed Debian 13 Perl package findings in
both current base images:

| Finding | Severity | Vendor fix |
| --- | --- | --- |
| CVE-2026-12087 | Critical | Not available |
| CVE-2026-48959 | High | Not available |
| CVE-2026-48962 | High | Not available |

PlanDelta does not invoke Perl at runtime. The services run as non-root
Node/Python processes, expose only their intended HTTP entry points, and do not
accept shell commands. These findings are accepted for this candidate because
no upstream image fix exists; base images must be rebuilt and rescanned when
Debian publishes one.

## Product limitations

- Evidence is review support, not automatic approval, takeoff, cost, code, or
  constructability certification.
- User-uploaded results depend on alignment and source quality; uncertainty and
  failed alignment remain visible instead of producing invented output.
- The ONNX classifier benchmark is synthetic and does not claim real-world
  accuracy.
- The precomputed public sample is labelled and remains available when
  temporary live compute is stopped.

## Vercel production deployment

The public frontend is verified at
[`https://plandelta-ai.vercel.app`](https://plandelta-ai.vercel.app). The
GitHub-connected `main` deployment uses the `apps/web` monorepo root, Next.js
preset, Node.js 22, and external workspace dependency access.

The live-enabled production deployment reached Ready and kept the production alias.
The public landing, passwordless sign-in page, authenticated upload flow,
comparison workspace, and labelled sample were rechecked without browser
warnings or errors; the drawing canvas loaded without horizontal overflow.
All tracked Markdown relative links resolved locally, and the Vercel, Semantic
Versioning, and release links returned HTTP 200.

The production project contains only the five required public configuration
names: Supabase URL, Supabase anonymous key, application URL, API URL, and the
live-processing availability flag. Values were not printed or committed.
The verified AWS API origin is configured and live processing is enabled.
Supabase accepts the exact
`https://plandelta-ai.vercel.app/auth/callback` redirect; a disposable
passwordless-link verification returned to that origin and the test user was
removed.

Verified remote evidence:

- The seven-case public browser suite passed, including landing, labelled
  sample, responsive layout, reduced motion, and the authenticated live
  journey.
- Two real uploaded drawings passed from Vercel through the AWS API, Supabase,
  private S3 storage, worker, vision service, comparison canvas, evidence crop,
  and printable report.
- The focused live rerun passed in 32 seconds and removed its analysis,
  revisions, project, and disposable user through production APIs.
- The 390 × 844 layout had no horizontal overflow and retained the evidence
  ledger.
- A fresh browser tab recorded no warnings or errors.
- CSP, HSTS, cross-origin opener, content-type, framing, referrer, permissions,
  and cross-domain-policy headers were present; production CSP excludes
  `unsafe-eval`.
- Thirteen public JavaScript assets contained none of the checked server-only
  environment names.

The final direct storage audit found 11 unreferenced objects from earlier
production E2E attempts. All four originals matched the committed test
fixtures, all seven derived artifacts belonged to a deleted test analysis, and
none had a database reference. Those exact synthetic objects were removed;
S3 then contained zero objects and zero incomplete multipart uploads.

## AWS runtime evidence

- `plandelta-cost-guard`, `plandelta-storage`, `plandelta-ecr`, and
  `plandelta-runtime` are complete in `us-east-1`.
- Exactly one `t3.small` runs with an encrypted 20 GB gp3 root volume, standard
  CPU credits, IMDSv2, 2 GB swap, one worker, and concurrency one.
- The public API passed HTTPS readiness, an authenticated upload-to-report
  journey, API restart recovery, and a natural three-attempt failure followed
  by recovery through the real retry endpoint.
- The deployed result contained one real CV/OCR change, seven private
  artifacts, and an evidence-constrained Bedrock report. Test data and
  incomplete multipart uploads were removed afterward.
- AWS Budgets reported USD 0.01 gross actual spend while Cost Explorer still
  reported USD 0.00 unblended spend. AWS did not yet provide a forecast, so the
  USD 22.94 conservative monthly ceiling and USD 10/15/20/25 gross-cost alerts
  remain authoritative.
- The retained live footprint at capture time was one `t3.small`, encrypted
  20 GB gp3, approximately 3.2 GB across the two ECR repositories, one
  encrypted SSM parameter, two healthy CloudWatch alarms, seven-day logs, and
  an empty S3 bucket.
- ECR scan-on-push is enabled, but a manual AWS Basic scan rejects the OCI
  image-index media type. The application dependencies and locally built
  images were scanned before deployment; future images should be built with
  provenance disabled if AWS Basic scan output is required.

## Live resource decision

On 2026-07-18, the user explicitly chose to keep live AWS processing available
for the portfolio demo. The one-instance runtime, encrypted root volume,
public IPv4, required ECR manifests, one encrypted SSM parameter, and bounded
CloudWatch resources are therefore retained intentionally. S3 was empty at the
decision point.

The USD 15 actual-spend review point, USD 25 teardown gate, and teardown steps
in [DEPLOYMENT.md](./DEPLOYMENT.md) remain binding. This decision does not
authorize adding capacity or any prohibited managed service.
