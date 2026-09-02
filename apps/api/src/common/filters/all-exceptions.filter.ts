import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

/**
 * Last-resort safety net for every unhandled exception.
 *
 * Nest's own HttpException instances (BadRequestException, ForbiddenException, ...) already
 * carry a deliberate, safe status and message, so they are forwarded as-is. Anything else -
 * a raw Error thrown by the pg driver, the AWS SDK, or a programming mistake - is logged in
 * full server-side but only ever exposed to the client as a generic 500, so internal details
 * (SQL text, stack traces, storage endpoints) never leak in a response body.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
