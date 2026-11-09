/** Stable, non-sensitive reason codes for provider failures. */
export type AiProviderFailureReason = 'TIMEOUT' | 'NETWORK_ERROR' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE';

/**
 * Provider failure with a safe public message. The reason is for internal classification/log metadata;
 * the underlying axios error, upstream body, prompt, and response content are never attached.
 */
export class AiProviderError extends Error {
  constructor(
    readonly reason: AiProviderFailureReason,
    message = 'The AI provider could not complete the request.',
  ) {
    super(message);
    this.name = 'AiProviderError';
    Object.setPrototypeOf(this, AiProviderError.prototype);
  }
}
