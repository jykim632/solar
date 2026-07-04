import { ApiErrorCode } from '@solar/api-contracts';
import { auth } from '@/lib/auth';
import { getWebEnv } from '@/lib/env';

interface ProxyOptions {
  /** NestJS 경로 — `/api/v1/` 뒤에 붙는 부분 (예: 'ops/datasources'). */
  path: string;
  method?: 'GET' | 'POST' | 'PATCH';
  /** 브라우저 query string에서 그대로 전달할 param 화이트리스트. */
  forwardParams?: readonly string[];
  /** true면 요청 JSON body를 그대로 전달 (POST/PATCH). */
  forwardBody?: boolean;
}

/**
 * BFF proxy 공통 처리 (§10.3): session cookie → Better Auth JWT → NestJS
 * Bearer call. 브라우저는 /api/bff/* 만 보고, JWT와 NestJS base URL은 서버에만
 * 둔다. generation/rec의 GET route와 동일 규약이며, ops의 PATCH/POST까지
 * 반복되면서 헬퍼로 추출(solar-up3).
 */
export async function proxyApiRequest(request: Request, options: ProxyOptions): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json(
      { code: ApiErrorCode.UNAUTHORIZED, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  let token: string;
  try {
    ({ token } = await auth.api.getToken({ headers: request.headers }));
  } catch {
    return Response.json(
      { code: ApiErrorCode.UNAUTHORIZED, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const { API_BASE_URL } = getWebEnv();
  const apiUrl = new URL(`${API_BASE_URL}/api/v1/${options.path}`);

  if (options.forwardParams) {
    const incomingUrl = new URL(request.url);
    for (const param of options.forwardParams) {
      for (const value of incomingUrl.searchParams.getAll(param)) {
        apiUrl.searchParams.append(param, value);
      }
    }
  }

  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  };

  let body: string | undefined;
  if (options.forwardBody) {
    body = await request.text();
    headers['content-type'] = 'application/json';
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(apiUrl, {
      method: options.method ?? 'GET',
      cache: 'no-store',
      headers,
      ...(body !== undefined && { body }),
    });
  } catch {
    return Response.json(
      { code: ApiErrorCode.INTERNAL, message: 'API is unavailable' },
      { status: 502 },
    );
  }

  const contentType = apiResponse.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return Response.json(
      { code: ApiErrorCode.INTERNAL, message: 'API returned a non-JSON response' },
      { status: 502 },
    );
  }

  const responseBody: unknown = await apiResponse.json();
  return Response.json(responseBody, { status: apiResponse.status });
}
