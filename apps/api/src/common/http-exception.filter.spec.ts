import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost, LoggerService } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

type MockResponse = {
  statusCode?: number;
  body?: unknown;
  status: (status: number) => MockResponse;
  json: (body: unknown) => MockResponse;
};

function createHost(): { host: ArgumentsHost; response: MockResponse } {
  const response: MockResponse = {
    status(status: number): MockResponse {
      this.statusCode = status;
      return this;
    },
    json(body: unknown): MockResponse {
      this.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function createLogger(): LoggerService {
  return {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    fatal: vi.fn(),
  };
}

describe('HttpExceptionFilter', () => {
  it('maps 400 validation errors to VALIDATION_FAILED with details', () => {
    const { host, response } = createHost();
    const filter = new HttpExceptionFilter(createLogger());

    filter.catch(
      new BadRequestException({
        message: 'Validation failed',
        details: [{ path: 'limit', message: 'Too small: expected number to be >=1' }],
      }),
      host,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: [{ path: 'limit', message: 'Too small: expected number to be >=1' }],
    });
  });

  it('maps plain 404 HttpException responses to NOT_FOUND', () => {
    const { host, response } = createHost();
    const filter = new HttpExceptionFilter(createLogger());

    filter.catch(new NotFoundException('missing route'), host);

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: 'missing route',
    });
  });

  it('maps unknown errors to 500 INTERNAL without leaking stack or message', () => {
    const { host, response } = createHost();
    const logger = createLogger();
    const filter = new HttpExceptionFilter(logger);

    filter.catch(new Error('database password leaked'), host);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      code: 'INTERNAL',
      message: 'Internal server error',
    });
    expect(JSON.stringify(response.body)).not.toContain('database password leaked');
    expect(logger.error).toHaveBeenCalled();
  });
});
