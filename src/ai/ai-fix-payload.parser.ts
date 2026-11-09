import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiFixPayload, STANDARD_AI_DISCLAIMER } from './ai-fix-payload';
import { AiProviderError } from '../errors/ai-provider.error';

function stripMarkdownFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/**
 * Parse clean or fenced JSON, validate every required key/type, and guarantee a non-empty disclaimer.
 * All failures become AiProviderError('INVALID_RESPONSE'); the raw content never leaves this function.
 */
export async function parseAiFixPayload(content: unknown): Promise<AiFixPayload> {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new AiProviderError('INVALID_RESPONSE');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(stripMarkdownFences(content));
  } catch {
    throw new AiProviderError('INVALID_RESPONSE');
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new AiProviderError('INVALID_RESPONSE');
  }

  const payload = plainToInstance(AiFixPayload, raw);
  const errors = await validate(payload, { whitelist: false, forbidUnknownValues: false });
  if (errors.length > 0) {
    throw new AiProviderError('INVALID_RESPONSE');
  }

  const disclaimer = payload.disclaimer?.trim();
  payload.disclaimer = disclaimer && disclaimer.length > 0 ? disclaimer : STANDARD_AI_DISCLAIMER;
  return payload;
}
