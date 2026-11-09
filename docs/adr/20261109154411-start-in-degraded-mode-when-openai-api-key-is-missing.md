# Start in degraded mode when OPENAI_API_KEY is missing

- **Status:** Accepted

## Context

Story 12 permits the API either to fail fast or to enter a degraded state when `OPENAI_API_KEY` is not
configured. Failing fast makes a missing credential impossible to miss, but it also makes `/health`
unreachable, which is exactly when an operator needs to observe the service. The API can still serve
useful, safe responses without a provider: it can report its own readiness and return a precise,
non-sensitive error for AI-backed requests.

The key itself is a secret. Any diagnostic must name the environment variable without echoing its value.

## Decision

`loadAppConfig` records a `configurationErrors` entry for a missing or blank `OPENAI_API_KEY` but never
throws. Bootstrap logs that entry at ERROR level through the structured logger, starts the HTTP server,
and selects `UnavailableAiProviderService` instead of the OpenAI adapter. `GET /health` reports
`503 unhealthy` with `checks.aiProvider.status = "down"`, and `POST /api/fix` returns `503` with
`code = "AI_PROVIDER_UNAVAILABLE"`.

## Consequences

- The process stays observable and rejects AI requests with a stable, actionable contract instead of
  crashing during deployment.
- A deployment with a misconfigured key can look superficially "up"; alerting must treat the 503 health
  response as a failure, not merely rely on process liveness.
- All other routes and the validation/error pipeline remain testable without credentials or network.
- The default provider timeout is 25,000 ms and is capped at 29,000 ms so the provider call plus
  application overhead stays inside the 30-second end-to-end budget.
