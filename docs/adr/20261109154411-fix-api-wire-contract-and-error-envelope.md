# Fix API wire contract and error envelope

- **Status:** Accepted

## Context

The frontend needs a stable, machine-actionable contract for `POST /api/fix`. Adjacent story drafts
contain conflicting paths and field casing (`/api/debug`, camelCase responses, `/api/health`); Story 12
fixes the public surface as `/api/fix`, snake_case request fields, and six snake_case response fields.
It also requires a 400 (not body-parser's default 413) for bodies over 100 KB, field-specific validation
details, correlation IDs on every response, and generic 500s that expose no internals.

## Decision

The request is `{ code_snippet, error_message }`, both required non-whitespace strings of at most
102,400 characters, with unknown fields rejected. A successful response is `201` with exactly
`fixed_code`, `explanation`, `root_cause`, `similar_issues`, `test_suggestions`, and `disclaimer`.
Every error uses the envelope `{ statusCode, error, code, message, correlationId, details? }`.
Validation uses stable codes (`VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `INVALID_JSON`), unexpected
server/provider failures collapse to `500 INTERNAL_SERVER_ERROR` with a generic message, and degraded
mode returns `503 AI_PROVIDER_UNAVAILABLE`. The transport enforces a 102,400-byte total JSON limit and
rewrites `entity.too.large` to `400 PAYLOAD_TOO_LARGE`.

## Consequences

- The wire surface is explicit and testable; the 400/413 choice and six-field success schema are locked
  by e2e tests rather than left to framework defaults.
- All errors carry the same correlation ID as the response header, so clients can report a precise
  identifier without seeing internals.
- `details` is additive and only present for validation errors, keeping 500 responses minimal.
- Future endpoints should reuse the envelope and the single `APP_FILTER`; adding per-endpoint error
  shapes would split the client contract.
- The 100 KB field limit matches the transport limit, so an over-length single field is normally caught
  as a payload-too-large transport error before DTO validation.
