export interface ErrorDetail {
  field: string;
  message: string;
}

/** The single public error envelope emitted by ApplicationExceptionFilter. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  correlationId: string;
  details?: ErrorDetail[];
}
