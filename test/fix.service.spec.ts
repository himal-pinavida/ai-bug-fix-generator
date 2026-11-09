import { FixService } from '../src/fix/fix.service';
import { MAX_FIELD_LENGTH } from '../src/common/constants';
import { RequestContextService } from '../src/common/request-context';
import { StructuredLogger } from '../src/common/structured-logger';
import { ValidationError } from '../src/errors/validation.error';
import { AiProviderUnavailableError } from '../src/errors/ai-provider-unavailable.error';
import { RecordingAiProvider, RecordingLogSink } from './doubles';

function harness(provider = new RecordingAiProvider()) {
  const sink = new RecordingLogSink();
  const service = new FixService(provider, new StructuredLogger(sink, new RequestContextService()));
  return { provider, sink, service };
}

const CODE = 'function add(a, b) {\n  return a - b;\n}';
const ERROR = 'AssertionError: expected 3 but received -1';

describe('FixService', () => {
  it('calls the provider once, maps exactly six fields, and logs metadata only', async () => {
    const { provider, sink, service } = harness();

    const response = await service.fix(CODE, ERROR);

    expect(provider.calls).toBe(1);
    expect(JSON.parse(provider.prompts[0].user)).toEqual({
      code_snippet: CODE,
      error_message: ERROR,
    });
    expect(Object.keys(response).sort()).toEqual([
      'disclaimer',
      'explanation',
      'fixed_code',
      'root_cause',
      'similar_issues',
      'test_suggestions',
    ]);
    expect(sink.text()).not.toContain('function add');
    expect(sink.text()).not.toContain('AssertionError');
    const completed = sink.records.find((record) => record.event === 'fix_request_completed');
    expect(typeof completed?.durationMs).toBe('number');
    expect(typeof completed?.responseBytes).toBe('number');
  });

  it.each([
    ['missing snippet', undefined, ERROR],
    ['blank snippet', '   ', ERROR],
    ['non-string snippet', 42, ERROR],
    ['over-length snippet', 'x'.repeat(MAX_FIELD_LENGTH + 1), ERROR],
    ['missing error message', CODE, undefined],
    ['blank error message', CODE, '\n\t'],
  ])('rejects %s for non-HTTP callers before invoking the provider', async (_label, code, error) => {
    const { provider, service } = harness();
    await expect(service.fix(code, error)).rejects.toBeInstanceOf(ValidationError);
    expect(provider.calls).toBe(0);
  });

  it('propagates a typed unavailable-provider error unchanged', async () => {
    const provider = new RecordingAiProvider();
    provider.failure = new AiProviderUnavailableError();
    const { service } = harness(provider);
    await expect(service.fix(CODE, ERROR)).rejects.toBeInstanceOf(AiProviderUnavailableError);
  });
});
