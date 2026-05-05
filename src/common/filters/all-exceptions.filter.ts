import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle nestjs-zod / class-validator structured errors
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, unknown>;
        message =
          typeof resObj.message === 'string'
            ? resObj.message
            : exception.message;
        errors = resObj.errors || null;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Exception: ${exception.message}`, exception.stack);
      // Optional: Handle TypeORM exceptions here if needed
    } else {
      this.logger.error(`Unhandled Exception: ${JSON.stringify(exception)}`);
    }

    // Log the error
    if (Number(status) >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${message}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message: message === 'Internal server error' && exception instanceof Error ? exception.message : message,
      errors: errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
