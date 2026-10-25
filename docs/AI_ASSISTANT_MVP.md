# CASEPULSE AI Casework Assistant MVP

## Status

Implementation branch: `feat/ai-casework-assistant`.

The MVP adds a read-only assistant panel and a server-side `/api/assistant` endpoint. The model adapter uses an OpenAI-compatible Chat Completions API without adding an SDK dependency. `AI_API_KEY` and `AI_MODEL` are server-only settings; `AI_API_BASE_URL` is optional and defaults to `https://api.openai.com/v1`.

## Supported MVP behavior

- Summarize an authorized case and its recorded actions.
- Explain recorded relationship signals and review status.
- Summarize an authorized institution's case counts and recorded relationships.
- Search a small, scoped set of records for general questions.
- Return links to the records retrieved for an answer.
- Operate read-only. It cannot create case actions, change statuses, or make overlap review decisions.

## Security design

- `requireActor` authenticates every assistant request before reading data or contacting the model.
- Record retrieval uses the existing repository methods and server-side bureau scoping. Client-provided IDs are validated and independently authorized by the repository.
- The browser never receives the provider API key. No `NEXT_PUBLIC_` AI configuration should be added.
- Request messages, content length, context IDs, and total request size are bounded.
- Provider errors are sanitized; provider response bodies, credentials, and case content are not written to application logs.
- The model instructions require evidence-only answers, citations by record ID, no legal conclusions, and no action-taking. Retrieved record content is explicitly treated as untrusted data to reduce prompt-injection risk.
- The UI identifies the assistant as AI-generated and read-only and provides links to supporting records.

## Configuration

Add these values to the local server environment (for example `.env.local`, which must remain untracked):

```dotenv
AI_PROVIDER="openai-compatible"
AI_API_KEY="your_provider_api_key"
AI_MODEL="your_provider_model_id"
# Optional, for an OpenAI-compatible API:
AI_API_BASE_URL="https://api.openai.com/v1"
```

Restart the Next.js server after changing environment variables. Do not paste the key into source files, chat messages, browser code, screenshots, or committed files.

## Data handling gate

Use synthetic or explicitly approved demo data for initial evaluation. Before sending real regulatory records to an external provider, obtain the relevant organizational approval and review data residency, retention, contractual terms, PII handling, and logging. The current retrieval payload may include case descriptions and relationship evidence, so the feature is not a declaration that real-case external processing is approved.

## Known limitations

- The adapter supports OpenAI-compatible Chat Completions APIs, not every provider-specific API shape.
- The initial retrieval layer uses existing structured search and stored relationships. It does not recompute correlations, use embeddings, or replace the deterministic correlation engine.
- Search is intentionally capped to a small number of records. Absence from the retrieved set does not prove that no related record exists.
- Citations link to retrieved records, but the generated prose still requires officer verification.
- Provider integration cannot be fully exercised until a valid API key and model ID are configured.
- Production OIDC, PostgreSQL integration tests, and the existing browser demo journey remain separate roadmap items.
