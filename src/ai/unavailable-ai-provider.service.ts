import { Injectable } from '@nestjs/common';
import { AiFixPayload } from './ai-fix-payload';
import { AiProvider } from './ai-provider';
import { FixPrompt } from './fix-prompt';
import { AiProviderUnavailableError } from '../errors/ai-provider-unavailable.error';

/** Degraded-mode provider: fails fast with a typed 503 without ever attempting a network call. */
@Injectable()
export class UnavailableAiProviderService implements AiProvider {
  async generateFix(_prompt: FixPrompt): Promise<AiFixPayload> {
    throw new AiProviderUnavailableError();
  }
}
