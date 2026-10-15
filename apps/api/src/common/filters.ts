import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Something went wrong';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        error = body;
      } else if (body && typeof body === 'object') {
        const record = body as { message?: unknown; details?: unknown };
        const message = record.message;
        error = Array.isArray(message) ? message.join(', ') : String(message || exception.message);
        details = record.details;
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.name : 'Unhandled error');
    }

    if (status >= 500 && process.env.SENTRY_DSN) {
      Sentry.captureException(exception);
    }

    response.status(status).json(details === undefined ? { error } : { error, details });
  }
}
