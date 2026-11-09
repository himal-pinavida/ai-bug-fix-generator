import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.token';
import { AppConfig } from '../config/app-config';
import { HealthResponse } from './health-response';

export interface HealthResult {
  statusCode: number;
  body: HealthResponse;
}

/** Readiness signal only: no inference, no provider call, and never any part of the API key. */
@Injectable()
export class HealthService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  check(): HealthResult {
    const base = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    if (this.config.openAiApiKey) {
      return {
        statusCode: 200,
        body: {
          status: 'ok',
          ...base,
          checks: { aiProvider: { status: 'up' } },
        },
      };
    }

    return {
      statusCode: 503,
      body: {
        status: 'unhealthy',
        ...base,
        checks: {
          aiProvider: {
            status: 'down',
            message: 'OPENAI_API_KEY is not configured; the service is running in degraded mode.',
          },
        },
      },
    };
  }
}
