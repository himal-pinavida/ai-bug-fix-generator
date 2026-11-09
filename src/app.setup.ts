import { INestApplication } from '@nestjs/common';
import { AppConfig } from './config/app-config';
import { CORRELATION_ID_HEADER } from './common/constants';
import { createValidationPipe } from './common/validation-pipe.factory';

/** Shared bootstrap used by main.ts and the HTTP test harness so tests exercise the real pipeline. */
export function configureApplication(app: INestApplication, config: AppConfig): void {
  app.useGlobalPipes(createValidationPipe());

  app.enableCors({
    origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [CORRELATION_ID_HEADER],
  });

  const instance = app.getHttpAdapter().getInstance() as { disable(setting: string): void };
  instance.disable('x-powered-by');
  app.enableShutdownHooks();
}
