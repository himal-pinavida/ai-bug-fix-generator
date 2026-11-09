import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestContextStore } from './request-context.types';

/**
 * Request-scoped correlation state backed by AsyncLocalStorage. The store survives async boundaries
 * (promises, axios calls, stream callbacks) without threading a request object through every layer.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(correlationId: string, callback: () => T): T {
    return this.storage.run({ correlationId }, callback);
  }

  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }
}
