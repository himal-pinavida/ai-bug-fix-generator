import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { AI_PROVIDER } from '../src/ai/ai-provider';
import { AppConfig, loadAppConfig } from '../src/config/app-config';
import { logConfigurationProblems } from '../src/config/startup-log';
import { LOG_SINK } from '../src/common/log-sink';
import { StructuredLogger } from '../src/common/structured-logger';
import { RecordingAiProvider, RecordingLogSink } from './doubles';

export interface TestAppOptions {
  config?: AppConfig;
  provider?: RecordingAiProvider;
  logSink?: RecordingLogSink;
}

export interface TestApp {
  app: INestApplication;
  config: AppConfig;
  provider?: RecordingAiProvider;
  logSink: RecordingLogSink;
  close(): Promise<void>;
}

/**
 * Build the real application composition root with the same configureApplication used by main.ts.
 * Body parsing is disabled so the correlation-then-JSON middleware order under test is the real one.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const config =
    options.config ?? loadAppConfig({ OPENAI_API_KEY: 'sk-test-offline', AI_PROVIDER_TIMEOUT_MS: '1000' });
  const logSink = options.logSink ?? new RecordingLogSink();
  const provider = options.provider ?? (config.openAiApiKey ? new RecordingAiProvider() : undefined);

  let builder = Test.createTestingModule({ imports: [AppModule.register(config)] });
  builder = builder.overrideProvider(LOG_SINK).useValue(logSink);
  if (provider) {
    builder = builder.overrideProvider(AI_PROVIDER).useValue(provider);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureApplication(app, config);
  await app.init();

  logConfigurationProblems(config, app.get(StructuredLogger));

  return {
    app,
    config,
    provider,
    logSink,
    close: () => app.close(),
  };
}
