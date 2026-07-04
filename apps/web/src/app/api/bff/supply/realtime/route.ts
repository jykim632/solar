import { ApiErrorCode } from '@solar/api-contracts';
import { auth } from '@/lib/auth';
import { getWebEnv } from '@/lib/env';

export const runtime = 'nodejs';

const forwardedQueryParams = ['hours'] as const;

/**
 * 실시간 전력수급 BFF proxy (§10.3): session cookie → Better Auth JWT → NestJS Bearer call.
 * 브라우저는 이 route만 보고, JWT와 NestJS base URL은 서버에만 둔다.
 */
export async function GET(request: Request): Promise<Response> {
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
  const incomingUrl = new URL(request.url);
  const apiUrl = new URL(`${API_BASE_URL}/api/v1/supply/realtime`);

  for (const param of forwardedQueryParams) {
    for (const value of incomingUrl.searchParams.getAll(param)) {
      apiUrl.searchParams.append(param, value);
    }
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
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

  const body: unknown = await apiResponse.json();
  return Response.json(body, { status: apiResponse.status });
}
