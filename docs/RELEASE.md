# Release Candidate Evidence

This record covers the local `v0.1.0-rc.1` candidate verified on 2026-07-18.
It does not treat GitHub, Vercel, or AWS deployment as complete; those phases
require their own remote checks.

## Local release gate

| Verification | Result |
| --- | --- |
| `pnpm format:check` | Passed |
| `pnpm lint` | Passed across all TypeScript and Python workspaces |
| `pnpm typecheck` | Passed with strict TypeScript and typed Python |
| `pnpm test` | 3 contract, 5 web, 26 API, and 27 vision tests passed |
| `pnpm test:e2e` | 3 contract, 26 API, 1 vision, and 6 browser checks passed; the credentialed live browser journey was intentionally skipped in the fixture suite |
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
