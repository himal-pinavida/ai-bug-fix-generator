import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { loadAppConfig } from './config/app-config';
import { logConfigurationProblems } from './config/startup-log';
import { StructuredLogger } from './common/structured-logger';

async function bootstrap(): Promise<void> {
  loadDotenv();
  const config = loadAppConfig(process.env);

  const app = await NestFactory.create(AppModule.register(config), { bodyParser: false });
  configureApplication(app, config);

  const logger = app.get(StructuredLogger);
  logConfigurationProblems(config, logger);

  await app.listen(config.port);
  logger.info('application_started', {
    port: config.port,
    degraded: !config.openAiApiKey,
  });
}

void bootstrap();
