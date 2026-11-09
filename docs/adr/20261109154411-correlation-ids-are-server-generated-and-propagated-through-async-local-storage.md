# Correlation IDs are server-generated and propagated through AsyncLocalStorage

- **Status:** Accepted

## Context

Every request needs one traceable UUID across middleware, controller, service, provider logs, and the
response. A client-supplied correlation header cannot be trusted for uniqueness or integrity, and an
oversized or malformed body must still produce a correlated 400 — which means correlation must be
established before the JSON parser runs.

Threading a request object through every layer would couple the service and provider adapter to HTTP.
Node's `AsyncLocalStorage` provides request-local context across promises and async callbacks without
that coupling.

## Decision

`CorrelationIdMiddleware` always calls `randomUUID()` (never an inbound header), sets
`X-Correlation-Id` on the response, stores the ID on the request, and runs the rest of the request in
`AsyncLocalStorage`. `AppModule.configure` applies it before `RequestBodyMiddleware`. Every structured
request log reads the ID from `RequestContextService`; the middleware also binds the response `finish`
handler to the same context so completion logs cannot lose it.

## Consequences

- Success, validation failure, oversized-body, malformed-JSON, and server-error responses all carry the
  same UUID, and every request-path record is correlatable.
- The inbound `X-Correlation-Id` header is deliberately ignored; upstream systems cannot supply their
  own ID for end-to-end stitching. This was chosen for trust and uniqueness; a future distributed-trace
  integration can add a validated inbound trace ID as separate metadata.
- Middleware order is a correctness requirement: correlation must be registered before body parsing.
- AsyncLocalStorage has a small per-request cost but no global map or cleanup obligation.
