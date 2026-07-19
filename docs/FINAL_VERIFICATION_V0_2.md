# Complete Final Verification and Repair Loop v0.2

Run this matrix only after all required v0.2 behavior is implemented and
integrated. Focused tests during development are still allowed and expected.

This phase does not end when failures are discovered. Fix every in-scope
failure, rerun the smallest failing check, then restart the complete matrix.
The final evidence must come from one clean, uninterrupted passing revision.

## 1. Clean-state preparation

- Confirm expected branch, commit, worktree, remotes, and preserved `v0.1.0`.
- Inspect ignored files and ensure secrets/uploads/models/build outputs are not
  tracked.
- Use a clean dependency/install state appropriate for the repository.
- Validate environment variable names without printing their values.
- Record runtime versions and available local resources.

## 2. Database

- Generate Prisma/client artifacts.
- Verify complete migrations transactionally against a clean database.
- Verify upgrade from a representative v0.1 schema/data state.
- Apply migrations and idempotent seeds.
- Verify RLS, ownership, hybrid search, active/stale versions, conflicts,
  citation constraints, and concurrent job leasing.
- Verify re-ingestion, deletion, and cleanup.

## 3. Static and build gates

Run the repository-equivalent commands for:

- formatting check;
- TypeScript and Python lint;
- strict TypeScript and Python typecheck;
- shared contract/schema generation and validation;
- Next.js production build;
- NestJS API/worker production build;
- FastAPI vision and agent package/build validation;
- all production Docker image builds.

## 4. Unit and service suites

- Existing contracts, web, API, worker, storage, summary, vision, OCR, ONNX,
  and report tests.
- Agent graph state/routing/node tests.
- Tool schema/scope/limit/deduplication tests.
- RAG extraction/chunking/embedding/hybrid ranking/conflict tests.
- Provider timeout/schema/fallback tests.
- Citation validator and safe Markdown tests.
- Domain-profile registry and mapping tests.
- Structured logging/redaction tests.

## 5. Integration and recovery

- Existing analysis queue claim, lease, heartbeat, retry, stale recovery, and
  idempotent persistence.
- Ingestion and agent queue concurrency/recovery.
- API restart during analysis and agent run.
- Agent-service restart/timeout and lease recovery.
- Duplicate client idempotency key.
- Cancellation before and during tool/model execution.
- Natural maximum-attempt exhaustion followed by authorized retry.
- Bedrock unavailable/invalid response fallback.
- Local embedding model unavailable or incompatible dimension failure.
- S3/local artifact authorization and cleanup.

## 6. Security and adversarial behavior

- Cross-user project, document, conversation, message, run, citation, and
  artifact access denial.
- RLS direct-access denial.
- Model-proposed foreign IDs.
- Prompt injection in user question, OCR, specification, addendum, and RFI.
- Malformed and oversized tool arguments/results.
- Arbitrary SQL/path/URL/tool-name attempts.
- Wrong revision and stale document retrieval.
- Conflicting records.
- Hallucinated change/page/citation IDs.
- Tool loop, repeated retrieval, token/time/cost limit.
- Upload signature/MIME/path traversal/size/page/pixel limits.
- Logs and browser bundle contain no secrets/private content.

## 7. Agent evaluations

- Run the complete deterministic evaluation dataset.
- Confirm every release threshold in `EVALS_V0_2.md`.
- Inspect failure details rather than only aggregate scores.
- Run the bounded live Bedrock subset when credentials are available.
- Record dataset, model, prompt, tool, chunker, and embedding versions.
- Record latency, tool calls, token use, and estimated cost.
- Do not hide failed cases from the committed summary.

## 8. End-to-end journeys

### Existing construction regression

1. Authenticate.
2. Create a construction project.
3. Upload baseline/candidate drawings.
4. Run real CV/OCR/ONNX analysis.
5. Observe Realtime/polling progress.
6. Inspect linked drawing evidence and report.
7. Retry a controlled failure.
8. Delete and verify private cleanup.

### Grounded Evidence Copilot

1. Upload a supported project document.
2. Observe extraction/embedding status.
3. Ask a visual-only question and verify no unnecessary RAG specialist.
4. Ask a document-only question and verify no unnecessary visual tool.
5. Ask a combined impact question.
6. Verify every citation target and adjacent claim.
7. Click visual and document citations.
8. Generate and review an unsent RFI draft.
9. Ask an unsupported question and verify safe behavior.

### Engineering schematic

1. Open/run the schematic sample.
2. Inspect real visual changes.
3. Retrieve its supporting document.
4. Ask all required golden questions.
5. Verify categories, citations, conflicts/uncertainty, and cached public sample.

## 9. Browser quality

- Desktop and 390x844 or equivalent mobile layouts.
- Keyboard-only journey and focus visibility.
- Screen-reader labels/live status behavior.
- Reduced motion.
- Reconnect, offline compute, loading, empty, error, refusal, conflict, quota,
  cancellation, retry, and disabled states.
- No browser console errors, hydration errors, unsafe HTML, or broken citations.
- Existing viewer/report performance remains acceptable.

## 10. Repository and supply chain

- Dependency audit with material findings resolved or documented.
- Container vulnerability review.
- License review for new model/package/data assets.
- Staged diff review.
- Full-history secret scan.
- No private evaluation data or generated model caches committed.
- README/docs/API diagrams and commands match behavior.

## 11. Full matrix rerun

After the last fix:

1. return to section 1;
2. run every required section again;
3. save the final command/result summary against one commit SHA;
4. confirm a clean worktree;
5. push and require all CI lanes to pass.

Do not tag or deploy a failing revision.

## 12. Production verification

After local/CI gates pass:

- verify current AWS cost/resources before deployment;
- migrate production safely;
- deploy immutable images and Vercel frontend;
- run one authenticated document-ingestion and cited-chat journey;
- verify construction and schematic public samples;
- verify live chat is unavailable truthfully when compute is unavailable;
- verify CloudWatch redaction, metrics, limits, alarms, and cleanup;
- record live URLs, release SHA/tag, actual/forecast cost, and resource state;
- rerun the critical public paths after the release commit.

If production smoke fails, repair, rerun the relevant local/CI checks, redeploy
the new immutable revision, and repeat production verification.
