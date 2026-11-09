import { EventEmitter } from 'node:events';
import { NextFunction, Response } from 'express';
import { CorrelationIdMiddleware } from '../src/common/correlation-id.middleware';
import { RequestContextService } from '../src/common/request-context';
import { CorrelatedRequest } from '../src/common/request-context.types';
import { StructuredLogger } from '../src/common/structured-logger';
import { RecordingLogSink } from './doubles';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('CorrelationIdMiddleware', () => {
  it('mints a UUID, ignores a client header, and correlates start/completion logs', () => {
    const sink = new RecordingLogSink();
    const context = new RequestContextService();
    const middleware = new CorrelationIdMiddleware(
      context,
      new StructuredLogger(sink, context),
    );
    const request = {
      method: 'POST',
      originalUrl: '/api/fix?secret=not-logged',
      headers: { 'content-length': '12', 'x-correlation-id': 'client-supplied' },
    } as unknown as CorrelatedRequest;
    const setHeader = jest.fn();
    const response = Object.assign(new EventEmitter(), { setHeader, statusCode: 201 }) as unknown as Response;

    let observedDuringNext: string | undefined;
    const next: NextFunction = () => {
      observedDuringNext = context.getCorrelationId();
    };

    middleware.use(request, response, next);

    const correlationId = setHeader.mock.calls[0][1] as string;
    expect(correlationId).toMatch(UUID_V4);
    expect(correlationId).not.toBe('client-supplied');
    expect(observedDuringNext).toBe(correlationId);
    expect(request.correlationId).toBe(correlationId);

    response.emit('finish');

    expect(sink.records.map((record) => record.event)).toEqual([
      'http_request_started',
      'http_request_completed',
    ]);
    expect(sink.records.every((record) => record.correlationId === correlationId)).toBe(true);
    expect(sink.records[1].statusCode).toBe(201);
    expect(sink.records[0].path).toBe('/api/fix');
    expect(sink.text()).not.toContain('client-supplied');
    expect(sink.text()).not.toContain('secret=not-logged');
  });
});
