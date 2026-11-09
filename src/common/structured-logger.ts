import { Inject, Injectable } from '@nestjs/common';
import { LOG_SINK, LogLevel, LogPrimitive, LogRecord, LogSink } from './log-sink';
import { RequestContextService } from './request-context';

type Metadata = Record<string, unknown>;

const RESERVED_KEYS = new Set(['timestamp', 'level', 'event', 'correlationId']);
const FORBIDDEN_KEYS = new Set([
  'body',
  'requestBody',
  'responseBody',
  'headers',
  'authorization',
  'apiKey',
  'prompt',
  'configuration',
  'config',
  'response',
  'message',
  'errorMessage',
]);

function isPrimitive(value: unknown): value is LogPrimitive {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Structured JSON logger. It accepts only primitive, explicitly-named metadata and drops forbidden
 * keys (bodies, headers, prompts, configuration, provider responses). Exception messages and the
 * first stack line are never emitted: only the error name, a primitive code, and stack frames.
 */
@Injectable()
export class StructuredLogger {
  constructor(
    @Inject(LOG_SINK) private readonly sink: LogSink,
    private readonly context: RequestContextService,
  ) {}

  info(event: string, metadata: Metadata = {}): void {
    this.write('info', event, metadata);
  }

  warn(event: string, metadata: Metadata = {}): void {
    this.write('warn', event, metadata);
  }

  log(level: LogLevel, event: string, metadata: Metadata = {}): void {
    this.write(level, event, metadata);
  }

  /** Log a safe error summary. Never emits error.message or the first (message-bearing) stack line. */
  error(event: string, error: unknown, metadata: Metadata = {}): void {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const rawCode = (error as { code?: unknown } | undefined)?.code;
    const errorCode = typeof rawCode === 'string' || typeof rawCode === 'number' ? rawCode : undefined;
    const stack = error instanceof Error && error.stack
      ? error.stack
          .split('\n')
          .slice(1)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join('\n')
      : undefined;

    this.write('error', event, {
      ...metadata,
      errorName,
      ...(errorCode !== undefined ? { errorCode } : {}),
      ...(stack ? { stack } : {}),
    });
  }

  private write(level: LogLevel, event: string, metadata: Metadata): void {
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      event,
      correlationId: this.context.getCorrelationId() ?? null,
    };

    for (const [key, value] of Object.entries(metadata)) {
      if (RESERVED_KEYS.has(key) || FORBIDDEN_KEYS.has(key) || !isPrimitive(value)) {
        continue;
      }
      record[key] = value;
    }

    this.sink.write(record);
  }
}
