import {
  ApiErrorCode,
  ApiErrorSchema,
  apiErrorCodeForHttpStatus,
  type ApiError,
} from '@solar/api-contracts';
import { z } from 'zod';

type BffPath = `/api/bff/${string}`;

export class ApiClientError extends Error {
  readonly status: number;
  readonly error: ApiError;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.error = error;
  }
}

/**
 * 브라우저 fetch 래퍼 (§7.2, solar-8wv.13). BFF 경계 전용 —
 * NestJS base URL도 토큰 로직도 브라우저 코드에 두지 않는다(§10.3).
 * 에러는 @solar/api-contracts의 envelope로 파싱해 typed로 던지고,
 * 성공 응답은 호출자가 준 Zod schema로 검증한다.
 */
export async function bffFetch<TSchema extends z.ZodType>(
  path: BffPath,
  schema: TSchema,
  init: RequestInit = {},
): Promise<z.infer<TSchema>> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      cache: init.cache ?? 'no-store',
      headers: withJsonAccept(init.headers),
    });
  } catch {
    throw new ApiClientError(0, {
      code: ApiErrorCode.INTERNAL,
      message: 'BFF request failed.',
    });
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw errorFromResponse(response.status, body);
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiClientError(response.status, {
      code: ApiErrorCode.INTERNAL,
      message: 'Unexpected BFF response shape.',
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '<root>',
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

function withJsonAccept(headers: HeadersInit | undefined): Headers {
  const merged = new Headers(headers);

  if (!merged.has('accept')) {
    merged.set('accept', 'application/json');
  }

  return merged;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json().catch(() => null);
}

function errorFromResponse(status: number, body: unknown): ApiClientError {
  const parsed = ApiErrorSchema.safeParse(body);

  if (parsed.success) {
    return new ApiClientError(status, parsed.data);
  }

  return new ApiClientError(status, {
    code: apiErrorCodeForHttpStatus(status),
    message: fallbackErrorMessage(status, body),
  });
}

function fallbackErrorMessage(status: number, body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }

  return `HTTP ${status}`;
}
