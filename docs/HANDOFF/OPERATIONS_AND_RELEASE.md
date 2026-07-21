# PlanDelta Operations and Release Guide

## Credentials and configuration

Never print credential values. Validate variable names only. Local secrets belong in ignored
`.env.local`. The required systems are:

- Supabase URL, public anon key, service-role key, pooled `DATABASE_URL`, and direct
  `DIRECT_DATABASE_URL`;
- AWS CLI profile `plandelta` in `us-east-1`, using the non-root `plandelta-builder` identity;
- Vercel interactive authentication and the linked production project;
- GitHub CLI/app authentication; never request or store a GitHub token in the repository.

Use `docs/CREDENTIALS.md` and `.env.example` as the authoritative variable-name lists. Do not copy
values into this handoff.

## Local setup

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm agent:install
pnpm vision:install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Common ports are web `3000`, API `4000`, vision `8000`, and internal agent `8100`. Supabase remains
external. `pnpm start:local` starts the bounded integration stack after builds. Docker Compose is the
closest production-shaped local runtime.

## Focused checks

```powershell
pnpm --filter @plandelta/web typecheck
pnpm --filter @plandelta/web lint
pnpm --filter @plandelta/web test
pnpm --filter @plandelta/api test
pnpm agent:test
pnpm --filter @plandelta/vision test
```

Run the real Supabase pgvector integration without echoing `.env.local`:

```powershell
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
$env:RUN_RAG_DATABASE_INTEGRATION='true'
node scripts/python.mjs -m pytest apps/agent/tests/test_rag_database_integration.py -q
```

This test creates disposable document/version/job records, performs real extraction, local BGE
embedding, hybrid retrieval, active-version replacement, explicit stale-conflict retrieval, and
cleanup.

The full local journeys are:

```powershell
pnpm verify:local-stack
pnpm verify:local-agentic
pnpm verify:local-e2e
```

Do not claim `verify:local-agentic` passed unless API, worker, and internal agent service were all
healthy and the output confirms ingestion, retrieved evidence, Bedrock synthesis, a verified
document citation, an unsent RFI draft, and cleanup.

## Full release gate

Run every section of `docs/FINAL_VERIFICATION_V0_2.md`. A failure starts a repair loop: fix the
underlying issue, rerun the smallest failure, then restart the complete matrix. Never skip/weaken a
test to obtain green status.

Minimum repository gates include:

```powershell
pnpm db:verify-clean
pnpm db:verify-behavior
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm agent:eval
pnpm build
pnpm test:e2e
docker compose build agent api vision
```

Before every push, review the staged diff and run the full-history secret scan configured by the CI
workflow. Push small Conventional Commits. CI must be green before merge/deployment claims.

## AWS inventory

Region: `us-east-1`. CloudFormation stacks:

- `plandelta-cost-guard`
- `plandelta-storage`
- `plandelta-ecr`
- `plandelta-runtime`

Other stable names:

- budget `plandelta-project-monthly`;
- ECR `plandelta-api`, `plandelta-agent`, `plandelta-vision`;
- instance role/profile `plandelta-runtime-us-east-1`;
- runtime tag `Project=plandelta-production`;
- private bucket `plandelta-<account-id>-us-east-1`;
- runtime config in an allowlisted SSM SecureString;
- nine `plandelta-*` CloudWatch alarms and finite-retention logs.

Inspect without mutating:

```powershell
aws cloudformation describe-stacks --profile plandelta --region us-east-1 `
  --stack-name plandelta-runtime
aws resource-groups list-group-resources --profile plandelta --region us-east-1 `
  --group-name plandelta-production
aws ec2 describe-instances --profile plandelta --region us-east-1 `
  --filters Name=tag:Project,Values=plandelta-production Name=instance-state-name,Values=running
aws cloudwatch describe-alarms --profile plandelta --region us-east-1 `
  --alarm-name-prefix plandelta-
aws budgets describe-budget --profile plandelta --account-id <account-id> `
  --budget-name plandelta-project-monthly
```

## Deployment

The backend deploy is commit-pinned and immutable. `infrastructure/aws/deploy-phase10.ps1` builds
and pushes API/agent/vision images, updates the runtime stack, and invokes the SSM refresh path.
`verify-phase9.ps1` checks cost/storage/IAM controls; `verify-phase10.ps1` checks the one-instance
runtime, encrypted disk, SSM, immutable images, all five services, HTTPS, logs, and alarms.

The frontend deploys from GitHub through Vercel after merge. If EC2 restarts and receives a new
public IP, the runtime refresh rotates its IP certificate and the public API origin/Vercel
configuration must be verified again. Never claim production is live from a successful push alone.

Production proof must include:

1. CI green on the exact commit.
2. Vercel deployment `Ready` on the exact commit.
3. AWS Phase 9/10 verifiers passing.
4. API health and version checked over HTTPS.
5. Authenticated drawing upload → deterministic findings → linked evidence → report → cleanup.
6. Document upload → completed ingestion → hybrid retrieval → Bedrock → verified citation → source
   opening → cleanup.
7. Construction and schematic public samples working when live compute is unavailable.
8. CloudWatch logs redacted, alarms checked, and cost/budget recorded.

## Incident triage

- Analysis stuck near 5%: check worker lease, source object accessibility, vision health, pixel/page
  limits, and failure code. Do not immediately resize EC2.
- Document never ready: inspect ingestion job stage/failure code, agent health, local embedding model
  availability/dimension, S3 read permission, and queue lease recovery.
- Copilot says insufficient evidence: confirm the document is `READY`, project IDs match, retrieval
  returned chunks, the supervisor selected `knowledge`, and verifier did not reject stale/conflicting
  citations. Insufficient evidence can be the correct result.
- Citation does not open: inspect API ownership, citation target state, Next.js authenticated proxy,
  and source existence; never expose S3 directly as a workaround.
- AWS runtime unavailable: use SSM and CloudWatch, not SSH. Keep the public samples truthful and
  available while compute is down.
- Bedrock outage: deterministic findings and stored sources remain usable; the system must return a
  bounded safe response rather than fabricated AI output.

Rollback and teardown details remain authoritative in `docs/DEPLOYMENT.md` and `docs/OPERATIONS.md`.

