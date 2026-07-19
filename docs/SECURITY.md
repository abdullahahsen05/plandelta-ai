# Security and Privacy

## Trust boundaries

- Browser is untrusted.
- Public NestJS API validates JWT, ownership, content, and limits.
- Worker is trusted application code but must still validate database state.
- FastAPI is internal and authenticates the calling service.
- Agent FastAPI is internal, requires a separate service token, and reloads
  server-authorized run context instead of accepting browser-selected scope.
- Supabase service role and AWS credentials are server-only.

## Secrets

- Use environment variables and platform secret stores.
- Commit only .env.example with placeholders.
- Never log authorization headers, cookies, signed URLs, database URLs, service
  role keys, AWS tokens, or raw Bedrock prompts containing private content.
- Prefer EC2 IAM instance roles and GitHub OIDC over long-lived AWS keys.
- Redact secrets in structured logging.

## Upload security

- Allowlist MIME and extension, and inspect file signatures.
- Reject path traversal and unsafe filenames.
- Generate storage keys; never trust user-provided paths.
- Enforce byte, pixel, and page-count limits.
- Guard decompression and image bombs.
- Run PDF/image parsing with timeouts and resource limits.
- Store objects privately.
- Delete temporary files in success and failure paths.

## Authorization

- Every project-owned route checks project ownership server-side.
- RLS provides defense in depth.
- Never accept owner_id from browser payloads.
- Artifact download is authorized before a short-lived URL is issued.
- Knowledge previews and every visual/document citation are re-authorized
  against the current owner and project before resolution.
- Tool arguments cannot contain owner, user, project, or analysis scope; those
  fields come from the server-created run context.
- Demo resources are isolated and rate limited.

## Service security

- Vision and agent FastAPI services bind privately where possible.
- If it must share a host network, require an internal secret and restrict
  security groups/firewall.
- Public API uses HTTPS only in production.
- Configure strict CORS for known Vercel/local origins.
- The API applies security headers, a 30-second default request timeout,
  separate per-IP read/write minute limits, and PostgreSQL-backed per-user
  upload/analysis quotas plus database-backed agent message, cost, and
  concurrency quotas. Defaults and multi-instance limitations are recorded in
  [OPERATIONS.md](./OPERATIONS.md).
- Containers run as non-root with read-only filesystem where feasible.

## AI safety

- Bedrock receives only the bounded evidence packet needed for the current
  authorized run.
- Supervisor and synthesis output are schema constrained; specialists and
  tools are allowlisted.
- OCR and supporting-document text are untrusted data. Injection signals cannot
  override policy, select tools, expand scope, or reveal prompts.
- Duplicate tool fingerprints, unique tool count, specialists, retrieved
  chunks, model turns, deadline, tokens, estimated cost, and repair passes are
  capped.
- Answers are not published until citations resolve to returned, in-scope,
  active evidence. Conflicts require both sides and a visible conflict status.
- Invalid output receives at most one repair and then a safe
  insufficient-evidence/failure response.

## Data lifecycle

- Originals and completed evidence remain until their owning revision or
  analysis is deleted; there is no hidden local expiry.
- Revision deletion removes the private original when no analysis references
  it. Analysis deletion removes its complete derived-artifact prefix.
- Failed database persistence after upload removes the newly written object.
- The AWS phase adds S3 lifecycle cleanup for abandoned multipart uploads and
  temporary/demo prefixes.
- CloudWatch logs use finite retention; structured records contain identifiers
  and metrics, not raw drawings, tokens, signed URLs, OCR text, prompts,
  answers, or retrieved chunks.
- User uploads are never training data. Full operational behavior is recorded
  in [OPERATIONS.md](./OPERATIONS.md).

## Pre-release checks

- Secret scan working tree and Git history.
- Dependency and container vulnerability scans.
- Cross-user authorization tests.
- Signed URL expiration test.
- CORS and security-header inspection.
- Verify S3 public access block.
- Verify IAM policy contains only required bucket/model/log actions.
- Verify the private agent port has no security-group ingress and the instance
  role permits only the configured on-demand Bedrock model.
- Run the frozen prompt-injection, cross-project, stale/conflict, timeout,
  cancellation, tool-loop, token, cost, and citation evaluation cases.
