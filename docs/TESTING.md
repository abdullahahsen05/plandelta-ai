# Testing Strategy

## Required root checks

- pnpm format:check or equivalent
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm test:e2e
- pnpm build

Every phase runs the smallest relevant checks. Local and final release gates run
the complete suite.

## Web

Use Vitest and React Testing Library for:

- upload validation
- analysis status and error rendering
- filter behavior
- coordinate conversion
- viewer control state
- report formatting
- reduced-motion and keyboard behavior

Use Playwright for:

1. Open built-in sample.
2. Create project.
3. Upload baseline and candidate fixtures.
4. Start analysis.
5. Observe progress.
6. Inspect a change and synchronize ledger/canvas selection.
7. Filter by change type.
8. Open printable report.
9. Retry a deliberately failed analysis.

## NestJS

Unit tests:

- ownership policies
- DTO validation
- storage key/path safety
- summary rules
- error mapping
- retry classification

Integration tests:

- project/revision/analysis lifecycle
- upload limits and MIME mismatch
- cross-user denial
- job claim concurrency
- lease expiration and recovery
- idempotent result persistence
- signed URL redaction

## FastAPI and CV

Pytest fixtures:

- identical plans
- translated/scaled revision
- small rotation
- added wall
- removed door
- changed dimension
- changed room label
- revision cloud/noise
- blank page
- unrelated sheets
- malformed file

Golden assertions should use tolerances:

- alignment confidence and reprojection error range
- changed-area ratio range
- expected region intersection-over-union
- OCR normalized value/confidence where stable
- maximum false-positive area for identical pair
- deterministic order after region sorting

Never assert exact raw floating-point matrices or OCR internals that make tests
unnecessarily brittle.

## Contract tests

- Generate or validate web/Nest types against OpenAPI.
- Validate Nest-to-FastAPI payloads against shared JSON Schema fixtures.
- schemaVersion changes require explicit fixture updates.

## Model tests

- Reproducible training seed and config.
- Train/validation separation.
- Per-class precision, recall, F1, and confusion matrix.
- PyTorch/ONNX parity within documented tolerance.
- CPU latency and memory measurement.
- Rules-versus-model comparison.

## CI lanes

1. Web lint/typecheck/unit/build.
2. Nest lint/typecheck/unit/integration with PostgreSQL service.
3. Vision Ruff/typecheck/Pytest with cached model assets where licensing allows.
4. Contract validation.
5. Playwright critical smoke using stable fixtures.
6. Secret and dependency scan.
7. Docker image build.

## Release evidence

Record in release notes:

- commit SHA
- commands run
- pass/fail summary
- representative CV metrics
- known limitations
- deployed smoke-test timestamp

Do not write fabricated badges or coverage numbers.
