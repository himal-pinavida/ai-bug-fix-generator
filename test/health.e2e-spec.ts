import request from 'supertest';
import { loadAppConfig } from '../src/config/app-config';
import { createTestApp, TestApp } from './test-app';

describe('GET /health (HTTP e2e)', () => {
  let harness: TestApp;

  afterEach(async () => {
    await harness.close();
  });

  it('returns 200/ok with the provider up when a key is configured, without calling inference', async () => {
    harness = await createTestApp();
    const response = await request(harness.app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.checks.aiProvider.status).toBe('up');
    expect(typeof response.body.uptime).toBe('number');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(harness.provider?.calls).toBe(0);
    expect(JSON.stringify(response.body)).not.toContain('sk-test-offline');
  });

  it('returns 503/unhealthy with the provider down when the key is missing', async () => {
    harness = await createTestApp({ config: loadAppConfig({}) });
    const response = await request(harness.app.getHttpServer()).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.aiProvider.status).toBe('down');
    expect(response.body.checks.aiProvider.message).toContain('OPENAI_API_KEY');
    expect(harness.logSink.records.some((record) => record.event === 'configuration_error')).toBe(true);
  });
});
