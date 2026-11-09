import { DynamicModule, MiddlewareConsumer, Module, NestModule, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { AppConfig } from './config/app-config';
import { APP_CONFIG } from './config/config.token';
import { LOG_SINK, StdoutLogSink } from './common/log-sink';
import { StructuredLogger } from './common/structured-logger';
import { RequestContextService } from './common/request-context';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { RequestBodyMiddleware } from './common/request-body.middleware';
import { AI_PROVIDER } from './ai/ai-provider';
import { OpenAiProviderService } from './ai/openai-ai-provider.service';
import { UnavailableAiProviderService } from './ai/unavailable-ai-provider.service';
import { ApplicationExceptionFilter } from './errors/application-exception.filter';
import { FixController } from './fix/fix.controller';
import { FixService } from './fix/fix.service';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

/**
 * Composition root. The AI provider is selected once from configuration; tests override the
 * AI_PROVIDER token and LOG_SINK to run entirely offline.
 */
@Module({})
export class AppModule implements NestModule {
  static register(config: AppConfig): DynamicModule {
    const provider: Provider = config.openAiApiKey
      ? { provide: AI_PROVIDER, useClass: OpenAiProviderService }
      : { provide: AI_PROVIDER, useClass: UnavailableAiProviderService };

    return {
      module: AppModule,
      imports: [
        HttpModule.register({
          timeout: config.aiProviderTimeoutMs,
          maxRedirects: 0,
        }),
      ],
      controllers: [FixController, HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: LOG_SINK, useClass: StdoutLogSink },
        StructuredLogger,
        RequestContextService,
        provider,
        FixService,
        HealthService,
        { provide: APP_FILTER, useClass: ApplicationExceptionFilter },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // Order matters: correlation first, so body-parser failures still carry the header and context.
    consumer.apply(CorrelationIdMiddleware, RequestBodyMiddleware).forRoutes('*');
  }
}
