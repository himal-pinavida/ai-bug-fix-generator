# AI Bug Fix Generator — Backend API

NestJS 10 backend for Story 12. It exposes `POST /api/fix` (validated code/error input proxied to an
OpenAI-compatible provider) and `GET /health`, with server-generated correlation IDs, structured
metadata-only logging, a single error mapper, and a degraded startup mode when no provider key exists.

## Prerequisites

- Node.js 20 or newer (this environment uses Node.js 22) and npm.
- No database, broker, Docker service, or real OpenAI credential is needed for builds or tests.

## Setup

```bash
npm ci
cp .env.example .env
# edit .env and set OPENAI_API_KEY for live AI fixes
```

`.env` is ignored by git. Never commit real credentials.

| Variable | Default | Behaviour |
| --- | --- | --- |
| `PORT` | `3001` | HTTP listen port. Invalid values fall back with a warning. |
| `OPENAI_API_KEY` | none | Required for live fixes. Missing/blank starts degraded mode; requests get 503. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model sent to the provider. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible base URL; `/chat/completions` is appended. |
| `AI_PROVIDER_TIMEOUT_MS` | `25000` | Per-request provider timeout; values above `29000` are capped to keep total latency under 30s. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed browser origins. |

## Run

```bash
npm run start:dev      # watch mode
npm run build          # compile to dist/
npm run start:prod     # run compiled dist/main.js
```

## API

### `POST /api/fix`

Request body (JSON):

```json
{
  "code_snippet": "function add(a, b) {\n  return a - b;\n}",
  "error_message": "AssertionError: expected 3 but received -1"
}
```

Both fields are required non-whitespace strings, each at most 102,400 characters. Unknown fields are
rejected. The total JSON body is limited to **102,400 bytes**; a larger body returns **400** with
`code: "PAYLOAD_TOO_LARGE"` (not body-parser's 413).

Success: **201** with exactly these six fields:

```json
{
  "fixed_code": "function add(a, b) {\n  return a + b;\n}",
  "explanation": "The operator subtracted instead of adding.",
  "root_cause": "Wrong arithmetic operator.",
  "similar_issues": ["Related subtraction/division mistakes"],
  "test_suggestions": ["Assert add(1, 2) === 3"],
  "disclaimer": "AI-generated suggestion — review and test before applying."
}
```

Every response includes `X-Correlation-Id` with a server-generated UUID v4. An inbound
`X-Correlation-Id` is not trusted or reused.

### Error envelope

All errors use exactly this shape (`details` is present for validation errors):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Validation failed for: code_snippet",
  "correlationId": "4c2b85e0-72a1-4cc4-be7a-1f8c6f1f6b6a",
  "details": [{ "field": "code_snippet", "message": "code_snippet must be a string" }]
}
```

Stable codes:

| Status | Code | Cause |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing/blank/wrong-type/unknown/over-length field. |
| 400 | `PAYLOAD_TOO_LARGE` | Total JSON body exceeds 102,400 bytes. |
| 400 | `INVALID_JSON` | Body is not valid JSON. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server or provider failure; generic message, no stack/internals. |
| 503 | `AI_PROVIDER_UNAVAILABLE` | `OPENAI_API_KEY` is not configured (degraded mode). |

### `GET /health`

With a configured key: **200** with `status: "ok"`, `uptime`, an ISO `timestamp`, and
`checks.aiProvider.status: "up"`. Without a key: **503** with `status: "unhealthy"` and
`checks.aiProvider.status: "down"` plus a safe explanation. Health never runs inference and never
returns any part of the key.

## Degraded startup

A missing or blank `OPENAI_API_KEY` does not throw. The process starts, emits a structured **ERROR**
record naming only `OPENAI_API_KEY`, and selects an unavailable provider. `/health` reports 503
unhealthy and `POST /api/fix` returns 503 `AI_PROVIDER_UNAVAILABLE`. See ADR
`20261109154411-start-in-degraded-mode-when-openai-api-key-is-missing.md`.

## Logging and privacy

Application structured logs are one JSON object per line with `timestamp`, `level`, `event`,
`correlationId`, and primitive metadata. Request lifecycle logs contain only method, path, status,
duration, payload bytes, and a stable error code for rejections. Logs never contain request/response
bodies, pasted code, error text, headers, prompts, provider responses, configuration objects, exception
messages, or API keys. Error logs retain only the error name, a primitive code, and stack frames with
the message-bearing first line removed.

## Tests

```bash
npm run lint
npm run typecheck
npm test             # unit + e2e
npm run test:unit
npm run test:e2e
```

All tests are offline: the `AI_PROVIDER` token is replaced with a recording double and
`LOG_SINK` captures structured records. No real `OPENAI_API_KEY` is required.

## Architecture decisions

- `docs/adr/20261109154411-start-in-degraded-mode-when-openai-api-key-is-missing.md`
- `docs/adr/20261109154411-correlation-ids-are-server-generated-and-propagated-through-async-local-storage.md`
- `docs/adr/20261109154411-use-nestjs-axios-http-service-behind-an-ai-provider-adapter.md`
- `docs/adr/20261109154411-fix-api-wire-contract-and-error-envelope.md`

The machine-readable contract is in `docs/api/openapi.yaml`.
