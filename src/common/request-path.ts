import { Request } from 'express';

/** Route path without the query string, even when middleware is mounted at a stripped Express baseUrl. */
export function requestPath(request: Request): string {
  const url = request.originalUrl || request.url || '/';
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}
