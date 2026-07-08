import {
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter, LoggerService } from '@nestjs/common';
import { apiErrorCodeForHttpStatus } from '@solar/api-contracts';
import type { ApiError, ApiErrorDetail } from '@solar/api-contracts';
import type { Response } from 'express';

/** Single API error-envelope filter for NestJS HTTP errors (§10, §15.3). */
@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  // LoggerService is an interface — reflection emits Object, so DI must not
  // try to resolve it. @Optional() lets the default kick in under APP_FILTER.
  constructor(
    @Optional() private readonly logger: LoggerService = new Logger(HttpExceptionFilter.name),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const { status, envelope } = this.toEnvelope(exception);

    response.status(status).json(envelope);
  }

  private toEnvelope(exception: unknown): { status: number; envelope: ApiError } {
    if (!(exception instanceof HttpException)) {
      this.logUnknownException(exception);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        envelope: {
          code: apiErrorCodeForHttpStatus(HttpStatus.INTERNAL_SERVER_ERROR),
          message: defaultMessageForStatus(HttpStatus.INTERNAL_SERVER_ERROR),
        },
      };
    }

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const envelope: ApiError = {
      code: apiErrorCodeForHttpStatus(status),
      message: messageForHttpException(exceptionResponse, status),
    };
    const details = detailsFromHttpException(exceptionResponse);

    if (details !== undefined) {
      envelope.details = details;
    }

    return { status, envelope };
  }

  private logUnknownException(exception: unknown): void {
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      return;
    }

    this.logger.error(`Unknown exception: ${String(exception)}`);
  }
}

function messageForHttpException(exceptionResponse: string | object, status: number): string {
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return defaultMessageForStatus(status);
  }

  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  if (isRecord(exceptionResponse)) {
    const { message, error } = exceptionResponse;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }

    if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
      return message.join('; ');
    }

    if (typeof error === 'string' && error.length > 0) {
      return error;
    }
  }

  return defaultMessageForStatus(status);
}

function detailsFromHttpException(exceptionResponse: string | object): ApiErrorDetail[] | undefined {
  if (!isRecord(exceptionResponse) || !Array.isArray(exceptionResponse.details)) {
    return undefined;
  }

  const details = exceptionResponse.details.filter(isApiErrorDetail);
  return details.length > 0 ? details : undefined;
}

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  return isRecord(value) && typeof value.path === 'string' && typeof value.message === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultMessageForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'Validation failed';
    case HttpStatus.UNAUTHORIZED:
      return 'Unauthorized';
    case HttpStatus.FORBIDDEN:
      return 'Forbidden';
    case HttpStatus.NOT_FOUND:
      return 'Not found';
    case HttpStatus.CONFLICT:
      return 'Conflict';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'Too many requests';
    default:
      return 'Internal server error';
  }
}
