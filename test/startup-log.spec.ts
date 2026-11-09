import { loadAppConfig } from '../src/config/app-config';
import { logConfigurationProblems } from '../src/config/startup-log';
import { RequestContextService } from '../src/common/request-context';
import { StructuredLogger } from '../src/common/structured-logger';
import { RecordingLogSink } from './doubles';

describe('logConfigurationProblems', () => {
  it('emits an ERROR that names the missing variable and never the secret value', () => {
    const sink = new RecordingLogSink();
    const logger = new StructuredLogger(sink, new RequestContextService());
    const config = loadAppConfig({ OPENAI_API_KEY: '   ' });

    logConfigurationProblems(config, logger);

    const errors = sink.records.filter((record) => record.level === 'error');
    // A warning-only implementation would be invisible in production alerting.
    expect(errors).toHaveLength(1);
    expect(errors[0].event).toBe('configuration_error');
    expect(String(errors[0].problem)).toContain('OPENAI_API_KEY');
    expect(sink.text()).not.toContain('secret');
    expect(errors[0].correlationId).toBeNull();
  });

  it('emits warnings at WARN level', () => {
    const sink = new RecordingLogSink();
    const logger = new StructuredLogger(sink, new RequestContextService());
    const config = loadAppConfig({ OPENAI_API_KEY: 'sk-test', PORT: '0' });

    logConfigurationProblems(config, logger);

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0].level).toBe('warn');
    expect(sink.records[0].event).toBe('configuration_warning');
  });
});
