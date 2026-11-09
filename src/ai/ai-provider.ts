import { AiFixPayload } from './ai-fix-payload';
import { FixPrompt } from './fix-prompt';

/** The only provider dependency FixService sees; tests replace this token with an offline double. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiProvider {
  generateFix(prompt: FixPrompt): Promise<AiFixPayload>;
}
