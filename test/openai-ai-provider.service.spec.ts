import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { OpenAiProviderService } from '../src/ai/openai-ai-provider.service';
import { buildFixPrompt } from '../src/ai/fix-prompt';
import { AppConfig, loadAppConfig } from '../src/config/app-config';
import { RequestContextService } from '../src/common/request-context';
import { StructuredLogger } from '../src/common/structured-logger';
import { AiProviderError } from '../src/errors/ai-provider.error';
import { makeAiFixPayload, RecordingLogSink } from './doubles';

function configured(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadAppConfig({
    OPENAI_API_KEY: 'sk-synthetic-credential',
    OPENAI_MODEL: 'gpt-test',
    OPENAI_BASE_URL: 'https://provider.example/v1',
    AI_PROVIDER_TIMEOUT_MS: '1234',
    ...overrides,
  });
}

function harness(): {
  post: jest.Mock;
  service: OpenAiProviderService;
  sink: RecordingLogSink;
  config: AppConfig;
} {
  const post = jest.fn();
  const http = { post } as unknown as HttpService;
  const sink = new RecordingLogSink();
  const config = configured();
  const logger = new StructuredLogger(sink, new RequestContextService());
  return { post, service: new OpenAiProviderService(http, config, logger), sink, config };
}

const PROMPT = buildFixPrompt('const sentinelCode = 1;', 'Error: sentinelError');

describe('OpenAiProviderService', () => {
  it('posts JSON mode to chat/completions with the configured model and prompt', async () => {
    const { post, service, config, sink } = harness();
    post.mockReturnValue(
      of({
        status: 200,
        data: { choices: [{ message: { content: JSON.stringify(makeAiFixPayload()) } }] },
      }),
    );

    const result = await service.generateFix(PROMPT);

    expect(result.fixed_code).toBe('const answer = 42;');
    expect(post).toHaveBeenCalledTimes(1); // a retry would show up as a second call
    const [url, body, options] = post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(url).toBe('https://provider.example/v1/chat/completions');
    expect(body).toEqual({
      model: config.openAiModel,
      messages: [
        { role: 'system', content: PROMPT.system },
        { role: 'user', content: PROMPT.user },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    expect(options.timeout).toBe(1234);
    expect(options.maxRedirects).toBe(0);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect((options.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-synthetic-credential',
    );
    expect(sink.text()).not.toContain('sentinelCode');
    expect(sink.text()).not.toContain('sentinelError');
  });

  it('maps an aborted/timeout request to TIMEOUT without exposing the axios message', async () => {
    const { post, service, sink } = harness();
    post.mockReturnValue(throwError(() => new AxiosError('synthetic-secret-message', 'ECONNABORTED')));

    await expect(service.generateFix(PROMPT)).rejects.toMatchObject({
      name: 'AiProviderError',
      reason: 'TIMEOUT',
    });
    expect(sink.text()).not.toContain('synthetic-secret-message');
  });

  it('maps a connection failure to NETWORK_ERROR', async () => {
    const { post, service } = harness();
    post.mockReturnValue(throwError(() => new AxiosError('synthetic-secret-message', 'ECONNREFUSED')));

    await expect(service.generateFix(PROMPT)).rejects.toMatchObject({ reason: 'NETWORK_ERROR' });
  });

  it('maps an upstream HTTP status to UPSTREAM_ERROR', async () => {
    const { post, service } = harness();
    const failure = Object.assign(new AxiosError('synthetic-secret-message', 'ERR_BAD_RESPONSE'), {
      response: { status: 500 } as AxiosResponse,
    });
    post.mockReturnValue(throwError(() => failure));

    await expect(service.generateFix(PROMPT)).rejects.toMatchObject({ reason: 'UPSTREAM_ERROR' });
  });

  it('maps malformed provider JSON to INVALID_RESPONSE', async () => {
    const { post, service } = harness();
    post.mockReturnValue(of({ status: 200, data: { choices: [{ message: { content: 'not json' } }] } }));

    await expect(service.generateFix(PROMPT)).rejects.toBeInstanceOf(AiProviderError);
  });

  it('maps a missing choices array to INVALID_RESPONSE', async () => {
    const { post, service } = harness();
    post.mockReturnValue(of({ status: 200, data: {} }));

    await expect(service.generateFix(PROMPT)).rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
  });
});
