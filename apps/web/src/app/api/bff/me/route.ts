import { auth } from '@/lib/auth';
import { getWebEnv } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * BFF proxy (§10.3): session cookie → Better Auth JWT → NestJS Bearer call.
 * The browser only ever sees this route; the JWT stays server-side.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let token: string;
  try {
    ({ token } = await auth.api.getToken({ headers: request.headers }));
  } catch {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { API_BASE_URL } = getWebEnv();

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${API_BASE_URL}/api/v1/me`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return Response.json({ message: 'API is unavailable' }, { status: 502 });
  }

  const contentType = apiResponse.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return Response.json({ message: 'API returned a non-JSON response' }, { status: 502 });
  }

  const body: unknown = await apiResponse.json();
  return Response.json(body, { status: apiResponse.status });
}
