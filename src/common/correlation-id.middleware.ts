import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { CORRELATION_ID_HEADER } from './constants';
import { RequestContextService } from './request-context';
import { CorrelatedRequest } from './request-context.types';
import { requestPath } from './request-path';
import { StructuredLogger } from './structured-logger';

/**
 * Always mints a fresh server-side UUID (an inbound correlation header is never trusted), publishes it
 * as X-Correlation-Id, and runs the remainder of the request inside AsyncLocalStorage. It is registered
 * before the JSON body parser so even parser failures carry a correlation ID.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private readonly context: RequestContextService,
    private readonly logger: StructuredLogger,
  ) {}

  use(request: CorrelatedRequest, response: Response, next: NextFunction): void {
    const correlationId = randomUUID();
    const startedAt = Date.now();
    const method = request.method;
    const path = requestPath(request);
    const payloadBytes = this.payloadBytes(request);

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    this.context.run(correlationId, () => {
      this.logger.info('http_request_started', { method, path, payloadBytes });

      response.on('finish', () => {
        this.context.run(correlationId, () => {
          this.logger.info('http_request_completed', {
            method,
            path,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            payloadBytes,
          });
        });
      });

      next();
    });
  }

  private payloadBytes(request: CorrelatedRequest): number {
    const raw = request.headers['content-length'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}
