import { ErrorDetail } from '../common/error-response';

/**
 * Base for typed domain errors. Domain/service code throws these; the global ApplicationExceptionFilter
 * is the one place that turns them into HTTP responses, keeping the domain layer HTTP-agnostic.
 */
export abstract class DomainError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  readonly details?: ErrorDetail[];

  protected constructor(message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
