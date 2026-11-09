import { Request } from 'express';

export interface RequestContextStore {
  correlationId: string;
}

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}
