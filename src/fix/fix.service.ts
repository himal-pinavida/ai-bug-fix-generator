import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER, AiProvider } from '../ai/ai-provider';
import { buildFixPrompt } from '../ai/fix-prompt';
import { StructuredLogger } from '../common/structured-logger';
import { FixResponseDto } from './dto/fix-response.dto';
import { validateFixInput } from './fix.validator';

@Injectable()
export class FixService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly logger: StructuredLogger,
  ) {}

  async fix(codeSnippet: unknown, errorMessage: unknown): Promise<FixResponseDto> {
    const input = validateFixInput(codeSnippet, errorMessage);
    const prompt = buildFixPrompt(input.code_snippet, input.error_message);
    const startedAt = Date.now();

    const payload = await this.provider.generateFix(prompt);
    const response = FixResponseDto.from(payload);

    this.logger.info('fix_request_completed', {
      durationMs: Date.now() - startedAt,
      responseBytes: Buffer.byteLength(JSON.stringify(response)),
    });

    return response;
  }
}
