import { DomainError } from './domain-error';

/** Invalid input -> 400 with a field-specific detail for a machine-actionable client response. */
export class ValidationError extends DomainError {
  readonly status = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(field: string, message: string) {
    super(message, [{ field, message }]);
  }
}
