import { AiFixPayload, STANDARD_AI_DISCLAIMER } from '../src/ai/ai-fix-payload';
import { AiProvider } from '../src/ai/ai-provider';
import { FixPrompt } from '../src/ai/fix-prompt';
import { LogRecord, LogSink } from '../src/common/log-sink';

export function makeAiFixPayload(overrides: Partial<AiFixPayload> = {}): AiFixPayload {
  const payload = new AiFixPayload();
  payload.fixed_code = 'const answer = 42;';
  payload.explanation = 'The value was never assigned.';
  payload.root_cause = 'A missing initializer.';
  payload.similar_issues = ['Related off-by-one bug'];
  payload.test_suggestions = ['Assert answer === 42'];
  payload.disclaimer = STANDARD_AI_DISCLAIMER;
  return Object.assign(payload, overrides);
}

/** Recording provider: counts calls, captures prompts, and can return or throw without any network. */
export class RecordingAiProvider implements AiProvider {
  calls = 0;
  readonly prompts: FixPrompt[] = [];
  result: AiFixPayload = makeAiFixPayload();
  failure?: unknown;

  async generateFix(prompt: FixPrompt): Promise<AiFixPayload> {
    this.calls++;
    this.prompts.push(prompt);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.result;
  }
}

/** Recording structured-log sink; tests assert on parsed records, never on stdout formatting. */
export class RecordingLogSink implements LogSink {
  readonly records: LogRecord[] = [];

  write(record: LogRecord): void {
    this.records.push(record);
  }

  text(): string {
    return JSON.stringify(this.records);
  }
}
