# Use NestJS HttpService behind an AI provider adapter

- **Status:** Accepted

## Context

The endpoint must call an OpenAI-compatible chat-completions API with JSON mode, a configured model,
a 25,000 ms default timeout capped at 29,000 ms, no retries, and no redirects. Adjacent integration
stories constrain outbound HTTP to the NestJS `HttpService`/axios path, and tests must run entirely
offline. The endpoint must not be coupled to one vendor SDK's request/response types.

## Decision

Define an `AI_PROVIDER` injection token and an `AiProvider` interface with
`generateFix(prompt): Promise<AiFixPayload>`. `OpenAiProviderService` implements it using
`@nestjs/axios` `HttpService` and axios, posting to `${OPENAI_BASE_URL}/chat/completions` with
`temperature: 0.2` and `response_format: { type: "json_object" }`. The key appears only in the
`Authorization` header. `UnavailableAiProviderService` implements the same interface for degraded
startup. Tests replace the token with a recording double, so no network or credential is required.

## Consequences

- `FixService` depends on one narrow interface; the vendor, transport, and payload shapes stay in the
  adapter and parser. The OpenAI SDK was rejected because it would bypass the required HttpService
  path and introduce a second HTTP stack/configuration surface.
- Timeouts, network failures, upstream statuses, and malformed payloads map to `AiProviderError` with a
  stable reason; the public 500 message remains generic.
- There is exactly one attempt per request: no retry policy means provider outages surface quickly
  rather than amplifying load, at the cost of transient-failure resilience.
- The parser, not the SDK, owns JSON/fence handling and type validation, so provider responses are
  validated the same way regardless of transport changes.
