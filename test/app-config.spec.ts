import {
  DEFAULT_AI_PROVIDER_TIMEOUT_MS,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_PORT,
  MAX_AI_PROVIDER_TIMEOUT_MS,
  loadAppConfig,
} from '../src/config/app-config';

describe('loadAppConfig', () => {
  it('supplies documented defaults and reports a missing key as degraded mode', () => {
    const config = loadAppConfig({});

    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.openAiModel).toBe(DEFAULT_OPENAI_MODEL);
    expect(config.openAiBaseUrl).toBe(DEFAULT_OPENAI_BASE_URL);
    expect(config.aiProviderTimeoutMs).toBe(DEFAULT_AI_PROVIDER_TIMEOUT_MS);
    expect(config.corsOrigins).toEqual(['*']);
    expect(config.openAiApiKey).toBeUndefined();
    // If degraded mode silently disappeared this would be empty and /api/fix would crash instead of 503.
    expect(config.configurationErrors).toHaveLength(1);
    expect(config.configurationErrors[0]).toContain('OPENAI_API_KEY');
  });

  it('keeps a configured key and produces no configuration error', () => {
    const config = loadAppConfig({ OPENAI_API_KEY: 'sk-configured' });
    expect(config.openAiApiKey).toBe('sk-configured');
    expect(config.configurationErrors).toEqual([]);
  });

  it('treats a blank key as missing and names only the environment variable', () => {
    const config = loadAppConfig({ OPENAI_API_KEY: '   ' });
    expect(config.openAiApiKey).toBeUndefined();
    const messages = [...config.configurationErrors, ...config.warnings].join(' ');
    expect(messages).toContain('OPENAI_API_KEY');
    expect(config.configurationErrors[0]).not.toContain('   ');
  });

  it('caps the provider timeout so total API latency stays below 30 seconds', () => {
    const config = loadAppConfig({ OPENAI_API_KEY: 'sk-test', AI_PROVIDER_TIMEOUT_MS: '60000' });
    expect(config.aiProviderTimeoutMs).toBe(MAX_AI_PROVIDER_TIMEOUT_MS);
    expect(config.warnings.join(' ')).toContain('capped');
  });

  it('uses safe fallbacks for invalid numeric values and records warnings', () => {
    const config = loadAppConfig({ OPENAI_API_KEY: 'sk-test', PORT: 'not-a-port', AI_PROVIDER_TIMEOUT_MS: '-4' });
    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.aiProviderTimeoutMs).toBe(DEFAULT_AI_PROVIDER_TIMEOUT_MS);
    expect(config.warnings).toHaveLength(2);
  });

  it('normalises the base URL, model, and CORS origin list', () => {
    const config = loadAppConfig({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: '  gpt-4.1-mini ',
      OPENAI_BASE_URL: 'https://example.test/v1///',
      CORS_ORIGINS: ' https://app.example.test , https://admin.example.test ',
    });
    expect(config.openAiModel).toBe('gpt-4.1-mini');
    expect(config.openAiBaseUrl).toBe('https://example.test/v1');
    expect(config.corsOrigins).toEqual(['https://app.example.test', 'https://admin.example.test']);
  });

  it('falls back to the default endpoint for an invalid base URL', () => {
    const config = loadAppConfig({ OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'not a url' });
    expect(config.openAiBaseUrl).toBe(DEFAULT_OPENAI_BASE_URL);
    expect(config.warnings.join(' ')).toContain('OPENAI_BASE_URL');
  });
});
