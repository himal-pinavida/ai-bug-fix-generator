import { parseAiFixPayload } from '../src/ai/ai-fix-payload.parser';
import { STANDARD_AI_DISCLAIMER } from '../src/ai/ai-fix-payload';
import { AiProviderError } from '../src/errors/ai-provider.error';
import { makeAiFixPayload } from './doubles';

const payloadJson = JSON.stringify(makeAiFixPayload());

describe('parseAiFixPayload', () => {
  it('accepts clean JSON and preserves a non-blank disclaimer', async () => {
    const parsed = await parseAiFixPayload(payloadJson);
    expect(parsed.fixed_code).toBe('const answer = 42;');
    expect(parsed.similar_issues).toEqual(['Related off-by-one bug']);
    expect(parsed.disclaimer).toBe(makeAiFixPayload().disclaimer);
  });

  it('accepts fenced json Markdown', async () => {
    const parsed = await parseAiFixPayload('```json\n' + payloadJson + '\n```');
    expect(parsed.explanation).toBe('The value was never assigned.');
  });

  it('falls back to the standard notice when the disclaimer is blank', async () => {
    const withBlank = JSON.stringify(makeAiFixPayload({ disclaimer: '   ' }));
    expect((await parseAiFixPayload(withBlank)).disclaimer).toBe(STANDARD_AI_DISCLAIMER);
  });

  it('rejects malformed JSON', async () => {
    await expect(parseAiFixPayload('{"fixed_code":')).rejects.toMatchObject({
      name: 'AiProviderError',
      reason: 'INVALID_RESPONSE',
    });
  });

  it('rejects a missing required field', async () => {
    const missingRootCause = JSON.stringify({ ...makeAiFixPayload(), root_cause: undefined });
    await expect(parseAiFixPayload(missingRootCause)).rejects.toBeInstanceOf(AiProviderError);
  });

  it('rejects type-invalid arrays', async () => {
    const invalid = JSON.stringify({ ...makeAiFixPayload(), similar_issues: [1, 2] });
    await expect(parseAiFixPayload(invalid)).rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
  });

  it('rejects non-string content', async () => {
    await expect(parseAiFixPayload(null)).rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
  });
});
