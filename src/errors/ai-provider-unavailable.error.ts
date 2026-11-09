import { DomainError } from './domain-error';

/** Degraded startup: no provider is configured, so requests that need inference return 503. */
export class AiProviderUnavailableError extends DomainError {
  readonly status = 503;
  readonly code = 'AI_PROVIDER_UNAVAILABLE';

  constructor() {
    super('The AI provider is not configured. Set OPENAI_API_KEY and restart the service.');
  }
}
