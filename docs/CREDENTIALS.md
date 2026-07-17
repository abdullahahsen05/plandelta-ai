# Credential Preflight

This checkpoint happens once before Phase 0. Its purpose is to prevent the build
from repeatedly stopping for Supabase, AWS, or deployment access later.

## Safety rule

Codex must ask the user to configure credentials locally. It must not request
that raw secrets be pasted into chat, committed to Git, printed to the terminal,
or placed in README/documentation.

The preferred root file is .env.local. It must be ignored by Git before Codex
reads or validates it. The committed .env.example remains placeholders only.

## Supabase values to request

Ask the user to obtain these from the intended Supabase project:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL using the pooled runtime connection when appropriate
- DIRECT_DATABASE_URL using the direct connection for migrations

Derive JWT issuer from SUPABASE_URL unless the project requires an override.
Do not treat the public anon key as a server secret, but still keep environment
configuration consistent.

Codex must confirm:

- project URL format is valid
- required names are present and non-placeholder
- .env.local is ignored
- a safe database connectivity check succeeds before migrations
- service role never enters browser code

Do not display connection strings, passwords, JWTs, or key prefixes.

## AWS access to request

Preferred approach:

1. AWS CLI v2 installed.
2. User authenticates a temporary local profile named plandelta with browser
   login or IAM Identity Center SSO.
3. Region is confirmed, defaulting to us-east-1 when required services exist.

Suggested commands for the user:

~~~powershell
aws --version
aws login --profile plandelta
aws sts get-caller-identity --profile plandelta
~~~

If aws login is unavailable:

~~~powershell
aws configure sso --profile plandelta
aws sso login --profile plandelta
aws sts get-caller-identity --profile plandelta
~~~

Environment configuration:

- AWS_PROFILE=plandelta
- AWS_REGION=us-east-1 or the confirmed region
- S3_BUCKET may be selected now or generated safely during the AWS phase
- S3_PREFIX=plandelta
- BEDROCK_REGION
- BEDROCK_MODEL_ID may remain a non-secret deployment choice until model access
  is verified

Codex must verify:

- STS identity succeeds using the named profile
- it is not using root access keys
- the role/user has only the permissions needed for PlanDelta
- the $100 promotional credit exists and its expiry/eligibility is understood
- AWS Budget alerts can be created

Do not ask for permanent AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in chat.
If an unavoidable temporary credential flow provides access key, secret, and
session token, the user places them locally and Codex never prints them.

## Required AWS capabilities

The deployment identity eventually needs scoped access for:

- STS identity
- EC2, EBS, security groups, instance profiles, and Systems Manager
- ECR image repositories
- the dedicated PlanDelta S3 bucket
- IAM creation/pass-role limited to PlanDelta roles
- Bedrock model discovery and invocation
- CloudWatch logs/metrics
- AWS Budgets and cost inspection

EC2 runtime must use an IAM instance role. GitHub Actions must use OIDC. Neither
stores permanent AWS keys.

## Existing GitHub access

The user states GitHub is already connected. Codex should run a safe
authentication-status check and continue. Ask for intervention only if that
check fails; do not request the existing token value.

## Vercel access

The final frontend deployment requires an authenticated Vercel CLI or an
already-connected GitHub/Vercel project. Ask the user to complete interactive
login rather than pasting a token into chat:

~~~powershell
vercel login
vercel whoami
~~~

Codex should record only that authentication succeeded. It must not print or
store a Vercel token in the repository. If the user plans to connect the GitHub
repository manually in the Vercel dashboard, record that decision and verify
the connection before Phase 8.

## Initial prompt Codex should send

Before beginning implementation, send a concise checklist that says:

1. Create root .env.local from .env.example.
2. Fill the listed Supabase values locally.
3. Authenticate AWS CLI profile plandelta using browser login/SSO.
4. Authenticate Vercel CLI or confirm the dashboard connection method.
5. Confirm the intended AWS region and $100 credit constraint.
6. Reply only that setup is complete; do not paste the secret values.

Then wait. After confirmation, validate access without exposing values and begin
Phase 0 automatically.
