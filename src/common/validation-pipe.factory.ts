import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError as ClassValidatorError } from 'class-validator';
import { ErrorDetail } from './error-response';

function flatten(errors: ClassValidatorError[], parent = ''): ErrorDetail[] {
  const details: ErrorDetail[] = [];

  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        details.push({ field, message });
      }
    }
    if (error.children && error.children.length > 0) {
      details.push(...flatten(error.children, field));
    }
  }

  return details;
}

/** Global validation: strip/reject unknown fields, transform DTOs, and expose field-level details. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors: ClassValidatorError[]) => {
      const details = flatten(errors);
      const fields = [...new Set(details.map((detail) => detail.field))];
      return new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: `Validation failed for: ${fields.join(', ')}`,
        details,
      });
    },
  });
}
