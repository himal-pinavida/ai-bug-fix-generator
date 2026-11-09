import { RequestContextService } from '../src/common/request-context';
import { StructuredLogger } from '../src/common/structured-logger';
import { RecordingLogSink } from './doubles';

describe('StructuredLogger', () => {
  it('drops forbidden/non-primitive metadata and strips the message-bearing stack line', () => {
    const sink = new RecordingLogSink();
    const logger = new StructuredLogger(sink, new RequestContextService());
    const error = new Error('SECRET_EXCEPTION_MESSAGE');
    error.name = 'SyntheticError';
    Object.assign(error, { code: 'E_SYNTHETIC' });
    error.stack = 'SyntheticError: SECRET_EXCEPTION_MESSAGE\n    at handler (/app/src/file.ts:10:5)';

    logger.error('synthetic_failure', error, {
      method: 'POST',
      body: 'PASTED_CODE_MUST_NOT_LOG',
      headers: { authorization: 'Bearer MUST_NOT_LOG' },
      prompt: 'PROMPT_MUST_NOT_LOG',
      response: 'RESPONSE_MUST_NOT_LOG',
      message: 'MESSAGE_MUST_NOT_LOG',
      nested: { unsafe: true },
    });

    const record = sink.records[0];
    // This assertion fails if the first stack line is retained: it contains the exception message.
    expect(record.stack).toBe('at handler (/app/src/file.ts:10:5)');
    expect(record.errorName).toBe('SyntheticError');
    expect(record.errorCode).toBe('E_SYNTHETIC');
    expect(record.method).toBe('POST');
    for (const key of ['body', 'headers', 'prompt', 'response', 'message', 'nested']) {
      expect(record[key]).toBeUndefined();
    }
    expect(sink.text()).not.toContain('SECRET_EXCEPTION_MESSAGE');
    expect(sink.text()).not.toContain('MUST_NOT_LOG');
  });

  it('includes the active correlation ID on request-path records', () => {
    const sink = new RecordingLogSink();
    const context = new RequestContextService();
    const logger = new StructuredLogger(sink, context);

    context.run('3f7bf2e3-4977-408c-9062-1715ea57338d', () => logger.info('inside_request'));

    expect(sink.records[0]).toMatchObject({
      level: 'info',
      event: 'inside_request',
      correlationId: '3f7bf2e3-4977-408c-9062-1715ea57338d',
    });
  });
});
