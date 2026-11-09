import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { json, NextFunction, Request, Response } from 'express';
import { MAX_REQUEST_BODY_BYTES } from './constants';

interface BodyParserError {
  type?: string;
  status?: number;
  statusCode?: number;
}

function badRequest(code: string, message: string): HttpException {
  return new HttpException(
    { statusCode: HttpStatus.BAD_REQUEST, error: 'Bad Request', code, message },
    HttpStatus.BAD_REQUEST,
  );
}

/**
 * The sole JSON body parser (Nest is created with bodyParser: false). The transport limit is a total
 * body-size cap, and body-parser's 413/parse failures are rewritten to the API's 400 contract.
 */
@Injectable()
export class RequestBodyMiddleware implements NestMiddleware {
  private readonly parser = json({
    limit: MAX_REQUEST_BODY_BYTES,
    strict: true,
    verify: (request, _response, buffer) => {
      (request as Request & { rawBodyBytes?: number }).rawBodyBytes = buffer.length;
    },
  });

  use(request: Request, response: Response, next: NextFunction): void {
    this.parser(request, response, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }

      const parserError = error as BodyParserError;
      if (parserError.type === 'entity.too.large' || parserError.status === 413) {
        next(badRequest('PAYLOAD_TOO_LARGE', 'Request body exceeds the 100KB limit.'));
        return;
      }
      if (parserError.type === 'entity.parse.failed' || parserError.type === 'entity.verify.failed') {
        next(badRequest('INVALID_JSON', 'Request body must be valid JSON.'));
        return;
      }

      next(error);
    });
  }
}
