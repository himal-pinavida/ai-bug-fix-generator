import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/config.token';
import { AppConfig } from '../config/app-config';
import { AiFixPayload } from './ai-fix-payload';
import { parseAiFixPayload } from './ai-fix-payload.parser';
import { AiProvider } from './ai-provider';
import { FixPrompt } from './fix-prompt';
import { AiProviderError, AiProviderFailureReason } from '../errors/ai-provider.error';
import { StructuredLogger } from '../common/structured-logger';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

/**
 * OpenAI adapter over @nestjs/axios (HttpService). One attempt per request, no redirects, bounded by
 * AI_PROVIDER_TIMEOUT_MS, JSON mode, and the API key only ever in the Authorization header.
 */
@Injectable()
export class OpenAiProviderService implements AiProvider {
  constructor(
    private readonly http: HttpService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly logger: StructuredLogger,
  ) {}

  async generateFix(prompt: FixPrompt): Promise<AiFixPayload> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.aiProviderTimeoutMs);
    const startedAt = Date.now();

    try {
      const response = await firstValueFrom(
        this.http.post<ChatCompletionResponse>(
          `${this.config.openAiBaseUrl}/chat/completions`,
          {
            model: this.config.openAiModel,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          },
          {
            headers: {
              Authorization: `Bearer ${this.config.openAiApiKey ?? ''}`,
              'Content-Type': 'application/json',
            },
            timeout: this.config.aiProviderTimeoutMs,
            maxRedirects: 0,
            signal: controller.signal,
          },
        ),
      );

      this.logger.info('ai_provider_request_completed', {
        durationMs: Date.now() - startedAt,
        statusCode: response.status,
      });

      return await parseAiFixPayload(response.data?.choices?.[0]?.message?.content);
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      const reason = this.classify(error);
      this.logger.error('ai_provider_request_failed', error, {
        durationMs: Date.now() - startedAt,
        reason,
      });
      throw new AiProviderError(reason);
    } finally {
      clearTimeout(timer);
    }
  }

  private classify(error: unknown): AiProviderFailureReason {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ERR_CANCELED') {
        return 'TIMEOUT';
      }
      return error.response ? 'UPSTREAM_ERROR' : 'NETWORK_ERROR';
    }
    return 'INVALID_RESPONSE';
  }
}
