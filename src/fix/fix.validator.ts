import { MAX_FIELD_LENGTH } from './fix.constants';
import { ValidationError } from '../errors/validation.error';

export interface FixInput {
  code_snippet: string;
  error_message: string;
}

function assertField(field: 'code_snippet' | 'error_message', value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError(field, `${field} must be a string`);
  }
  if (value.trim().length === 0) {
    throw new ValidationError(field, `${field} must not be empty`);
  }
  if (value.length > MAX_FIELD_LENGTH) {
    throw new ValidationError(field, `${field} must be at most ${MAX_FIELD_LENGTH} characters`);
  }
  return value;
}

/** Re-assert the HTTP DTO rules for non-HTTP callers that invoke FixService directly. */
export function validateFixInput(codeSnippet: unknown, errorMessage: unknown): FixInput {
  return {
    code_snippet: assertField('code_snippet', codeSnippet),
    error_message: assertField('error_message', errorMessage),
  };
}
