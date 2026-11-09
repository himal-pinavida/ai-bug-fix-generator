import request from 'supertest';
import { loadAppConfig } from '../src/config/app-config';
import { RecordingAiProvider } from './doubles';
import { createTestApp, TestApp } from './test-app';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CODE = 'function add(a, b) {\n  return a - b;\n}';
const ERROR = 'AssertionError: expected 3 but received -1';
const VALID_BODY = { code_snippet: CODE, error_message: ERROR };

describe('POST /api/fix (HTTP e2e)', () => {
  let harness: TestApp;

  beforeEach(async () => {
    harness = await createTestApp();
  });

  afterEach(async () => {
    await harness.close();
  });

  it('returns 201 with exactly six fields, a UUID header, and one constructed prompt', async () => {
    const response = await request(harness.app.getHttpServer()).post('/api/fix').send(VALID_BODY);

    expect(response.status).toBe(201);
    // An extra field (provider metadata, raw model content) would fail this exact-set assertion.
    expect(Object.keys(response.body).sort()).toEqual([
      'disclaimer',
      'explanation',
      'fixed_code',
      'root_cause',
      'similar_issues',
      'test_suggestions',
    ]);
    const correlationId = response.headers['x-correlation-id'];
    expect(correlationId).toMatch(UUID_V4);

    // Asserting only "called" would pass with an empty or malformed prompt; compare the exact payload.
    expect(harness.provider?.calls).toBe(1);
    expect(JSON.parse(harness.provider?.prompts[0].user ?? '')).toEqual({
      code_snippet: CODE,
      error_message: ERROR,
    });

    const requestLogs = harness.logSink.records.filter(
      (record) => record.event === 'http_request_started' || record.event === 'http_request_completed',
    );
    expect(requestLogs).toHaveLength(2);
    expect(requestLogs.every((record) => record.correlationId === correlationId)).toBe(true);
    // Wildcard middleware must not reduce the route to "/"; the actual path is required for tracing.
    expect(requestLogs.every((record) => record.path === '/api/fix')).toBe(true);
  });

  it('returns 400 with code_snippet details and never invokes the provider when it is missing', async () => {
    const response = await request(harness.app.getHttpServer())
      .post('/api/fix')
      .send({ error_message: ERROR });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('code_snippet');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'code_snippet' })]),
    );
    expect(response.headers['x-correlation-id']).toBe(response.body.correlationId);
    expect(harness.provider?.calls).toBe(0);
  });

  it.each([
    ['unknown field', { ...VALID_BODY, unexpected: 'value' }],
    ['whitespace-only code', { ...VALID_BODY, code_snippet: '   \n\t' }],
    ['wrong type', { ...VALID_BODY, code_snippet: 42 }],
    ['blank error message', { ...VALID_BODY, error_message: '  ' }],
  ])('rejects %s with 400 before reaching the provider', async (_label, body) => {
    const response = await request(harness.app.getHttpServer()).post('/api/fix').send(body);

    expect(response.status).toBe(400);
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    expect(harness.provider?.calls).toBe(0);
  });

  it('returns 400 PAYLOAD_TOO_LARGE (not 413) for a body over 100KB, with zero provider calls', async () => {
    const oversized = { code_snippet: 'x'.repeat(102_401), error_message: ERROR };
    expect(Buffer.byteLength(JSON.stringify(oversized))).toBeGreaterThan(102_400);

    const response = await request(harness.app.getHttpServer()).post('/api/fix').send(oversized);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
    // The correlation middleware runs before the parser, so even a rejected body has the header.
    expect(response.headers['x-correlation-id']).toMatch(UUID_V4);
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    expect(harness.provider?.calls).toBe(0);
  });

  it('returns 400 INVALID_JSON for malformed JSON without reaching the provider', async () => {
    const response = await request(harness.app.getHttpServer())
      .post('/api/fix')
      .set('Content-Type', 'application/json')
      .send('{"code_snippet": "unterminated');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_JSON');
    expect(response.headers['x-correlation-id']).toBe(response.body.correlationId);
    expect(harness.provider?.calls).toBe(0);
  });

  it('collapses a provider exception to a generic 500 and never leaks markers or the API key', async () => {
    const apiKey = 'sk-sentinel-MUST-NOT-LEAK';
    const codeMarker = 'CODE_SENTINEL_7f3a';
    const errorMarker = 'ERROR_SENTINEL_9b2c';
    const provider = new RecordingAiProvider();
    provider.failure = new Error(`${codeMarker} ${errorMarker} ${apiKey}`);
    await harness.close();
    harness = await createTestApp({
      config: loadAppConfig({ OPENAI_API_KEY: apiKey, AI_PROVIDER_TIMEOUT_MS: '1000' }),
      provider,
    });

    const response = await request(harness.app.getHttpServer())
      .post('/api/fix')
      .send({ code_snippet: `${CODE}\\n// ${codeMarker}`, error_message: `${ERROR} ${errorMarker}` });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    expect(response.body.stack).toBeUndefined();

    const responseText = response.text;
    const logText = harness.logSink.text();
    for (const sentinel of [codeMarker, errorMarker, apiKey]) {
      expect(responseText).not.toContain(sentinel);
      expect(logText).not.toContain(sentinel);
    }
  });

  it('issues a different UUID v4 for each request', async () => {
    const first = await request(harness.app.getHttpServer()).post('/api/fix').send(VALID_BODY);
    const second = await request(harness.app.getHttpServer()).post('/api/fix').send(VALID_BODY);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.headers['x-correlation-id']).toMatch(UUID_V4);
    expect(second.headers['x-correlation-id']).toMatch(UUID_V4);
    expect(first.headers['x-correlation-id']).not.toBe(second.headers['x-correlation-id']);
    expect(harness.provider?.calls).toBe(2);
  });

  it('does not log the pasted code or error text on a successful request', async () => {
    await request(harness.app.getHttpServer()).post('/api/fix').send(VALID_BODY).expect(201);

    const logText = harness.logSink.text();
    expect(logText).not.toContain('function add');
    expect(logText).not.toContain('AssertionError');
    expect(logText).not.toContain('return a - b');
  });

  it('starts degraded without OPENAI_API_KEY and returns 503 without invoking a provider', async () => {
    await harness.close();
    harness = await createTestApp({ config: loadAppConfig({}) });

    const response = await request(harness.app.getHttpServer()).post('/api/fix').send(VALID_BODY);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AI_PROVIDER_UNAVAILABLE');
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    expect(harness.provider).toBeUndefined();
    const startupError = harness.logSink.records.find((record) => record.event === 'configuration_error');
    expect(startupError?.level).toBe('error');
    expect(String(startupError?.problem)).toContain('OPENAI_API_KEY');
  });
});
