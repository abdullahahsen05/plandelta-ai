# Security and Privacy

## Trust boundaries

- Browser is untrusted.
- Public NestJS API validates JWT, ownership, content, and limits.
- Worker is trusted application code but must still validate database state.
- FastAPI is internal and authenticates the calling service.
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
- Demo resources are isolated and rate limited.

## Service security

- FastAPI binds privately where possible.
- If it must share a host network, require an internal secret and restrict
  security groups/firewall.
- Public API uses HTTPS only in production.
- Configure strict CORS for known Vercel/local origins.
- Add request size limits, timeouts, and per-user rate limits.
- Containers run as non-root with read-only filesystem where feasible.

## AI safety

- Bedrock receives only the minimum evidence needed.
- Prompt instructs the model to use supplied evidence and return strict JSON.
- Validate model output with a schema.
- Treat blueprint text as untrusted data, not instructions.
- Do not let OCR text override system behavior or select tools.
- Mark AI summaries and uncertainty.
- Fall back to deterministic summaries on invalid or failed AI output.

## Data lifecycle

- Document retention for original uploads, derived artifacts, and logs.
- S3 lifecycle removes demo and temporary artifacts.
- Project deletion queues object cleanup.
- Logs contain identifiers and metrics, not raw drawings.
- Do not include user uploads in training data.

## Pre-release checks

- Secret scan working tree and Git history.
- Dependency and container vulnerability scans.
- Cross-user authorization tests.
- Signed URL expiration test.
- CORS and security-header inspection.
- Verify S3 public access block.
- Verify IAM policy contains only required bucket/model/log actions.
