export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogPrimitive = string | number | boolean | null | undefined;

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  correlationId: string | null;
  [key: string]: LogPrimitive;
}

/** Destination for structured log records. Tests replace this with a recording sink. */
export interface LogSink {
  write(record: LogRecord): void;
}

/** DI token for the LogSink implementation. */
export const LOG_SINK = Symbol('LOG_SINK');

/** Default sink: exactly one JSON object per stdout line. */
export class StdoutLogSink implements LogSink {
  write(record: LogRecord): void {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}
