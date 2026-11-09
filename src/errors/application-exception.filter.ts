import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import { Response } from 'express';
import { ErrorDetail, ErrorResponse } from '../common/error-response';
import { CORRELATION_ID_HEADER } from '../common/constants';
import { RequestContextService } from '../common/request-context';
import { requestPath } from '../common/request-path';
import { CorrelatedRequest } from '../common/request-context.types';
import { StructuredLogger } from '../common/structured-logger';
import { AiProviderUnavailableError } from './ai-provider-unavailable.error';
import { DomainError } from './domain-error';

interface ResolvedError {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: ErrorDetail[];
}

/**
 * The ONE global error mapper (APP_FILTER). Safe 4xx errors preserve their field details; typed domain
 * errors keep their stable code; everything unexpected collapses to a generic 500 so no stack, message
 * internals, provider output, or credentials can reach a client or a log record.
 */
@Catch()
export class ApplicationExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly context: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<CorrelatedRequest>();

    const correlationId =
      this.context.getCorrelationId() ?? request.correlationId ?? this.existingHeader(response);
    const resolved = this.resolve(exception);

    if (!response.headersSent) {
      response.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    if (resolved.statusCode >= 500) {
      if (exception instanceof AiProviderUnavailableError) {
        this.logger.warn('ai_provider_unavailable', { method: request.method, path: requestPath(request) });
      } else {
        this.logger.error('unhandled_exception', exception, {
          method: request.method,
          path: requestPath(request),
          statusCode: resolved.statusCode,
        });
      }
    } else {
      this.logger.info('http_request_rejected', {
        method: request.method,
        path: requestPath(request),
        statusCode: resolved.statusCode,
        code: resolved.code,
      });
    }

    if (response.headersSent) {
      return;
    }

    const body: ErrorResponse = {
      statusCode: resolved.statusCode,
      error: resolved.error,
      code: resolved.code,
      message: resolved.message,
      correlationId,
      ...(resolved.details ? { details: resolved.details } : {}),
    };
    response.status(resolved.statusCode).json(body);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof AiProviderUnavailableError) {
      return {
        statusCode: exception.status,
        error: STATUS_CODES[exception.status] ?? 'Service Unavailable',
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof DomainError) {
      return {
        statusCode: exception.status,
        error: STATUS_CODES[exception.status] ?? 'Error',
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const raw = exception.getResponse();

      if (statusCode < 500) {
        const object = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : undefined;
        const rawMessage = object?.message;
        const message = Array.isArray(rawMessage)
          ? rawMessage.map(String).join('; ')
          : typeof rawMessage === 'string'
            ? rawMessage
            : typeof raw === 'string'
              ? raw
              : exception.message;
        const code = typeof object?.code === 'string' ? object.code : `HTTP_${statusCode}`;
        const error = typeof object?.error === 'string' ? object.error : STATUS_CODES[statusCode] ?? 'Error';
        const details = Array.isArray(object?.details) ? (object.details as ErrorDetail[]) : undefined;
        return { statusCode, error, code, message, ...(details ? { details } : {}) };
      }
    }

    return {
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private existingHeader(response: Response): string {
    const header = response.getHeader(CORRELATION_ID_HEADER);
    return typeof header === 'string' ? header : 'unknown';
  }
}
