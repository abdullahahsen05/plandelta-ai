# Release evidence

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
