# v0.2 Configuration and Credential Addendum

Use the existing ignored `.env.local`, Supabase project, Vercel connection, AWS
profile, Bedrock access, S3 bucket, and deployment roles. Do not ask the user to
paste raw secret values in chat.

## Startup verification

- Confirm `.env.local` is ignored before checking it.
- Verify only variable presence and safe format; never echo the file.
- Verify Supabase pooled/direct database access safely.
- Verify the existing temporary `plandelta` AWS CLI identity and region with
  STS without exposing account credentials.
- Verify the configured Bedrock model remains accessible.
- Verify GitHub and Vercel authentication already present.
- Confirm current AWS cost and resource status.

Ask for user intervention only when interactive authentication has expired or a
required permission is missing. Do not repeat the original broad credential
request when existing access works.

## New non-secret configuration names

Add documented placeholders to the repository `.env.example` as implemented:

- `AGENT_SERVICE_URL`
- `AGENT_CHAT_PROVIDER=bedrock`
- `AGENT_EMBEDDING_PROVIDER=local`
- `AGENT_EMBEDDING_MODEL`
- `AGENT_EMBEDDING_DIMENSION`
- `AGENT_MAX_MODEL_TURNS`
- `AGENT_MAX_TOOL_CALLS`
- `AGENT_MAX_RETRIEVED_CHUNKS`
- `AGENT_MAX_REPAIR_PASSES`
- `AGENT_RUN_TIMEOUT_SECONDS`
- `AGENT_MAX_ESTIMATED_COST_USD`
- `AGENT_DAILY_USER_LIMIT`
- `AGENT_DAILY_USER_COST_LIMIT_USD`
- `AGENT_WORKER_CONCURRENCY=1`
- `KNOWLEDGE_MAX_FILE_BYTES`
- `KNOWLEDGE_MAX_PAGES`
- `KNOWLEDGE_CHUNK_SIZE`
- `KNOWLEDGE_CHUNK_OVERLAP`
- `KNOWLEDGE_HYBRID_TEXT_WEIGHT`
- `KNOWLEDGE_HYBRID_VECTOR_WEIGHT`
- `AGENT_TRACE_CONTENT_ENABLED=false`

The final exact names must match typed environment validation and deployment
documentation.

## New secret configuration

Use one strong service-to-service secret such as `AGENT_INTERNAL_TOKEN`, or
extend the existing internal-service authentication design if it safely
supports multiple services. Generate/store it locally and in encrypted SSM;
never commit, print, or send it to the browser.

Do not add another external API key. Local development and deterministic tests
must work without live Bedrock. Live agent reasoning reuses the existing AWS
Bedrock authorization through the EC2 instance role or temporary local profile.

## IAM changes

Add only permissions required for the existing runtime role to invoke the
configured Bedrock model if they are not already present. The agent service
must not receive broad S3, IAM, EC2, or database-administration permissions.
Private artifact/document access should flow through scoped application/storage
provider behavior.

## Secret verification

Before every push and deployment:

- inspect staged changes;
- run the repository secret scan against current files and full history;
- ensure environment files, local documents, embeddings, model caches, agent
  traces, and evaluation outputs containing private data are ignored;
- inspect the browser bundle for server-only variable names/values.
