import { proxyApiRequest } from '@/lib/bff-proxy';

export const runtime = 'nodejs';

/** 수집 kill switch 토글 — datasource.enabled (solar-up3). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  return proxyApiRequest(request, {
    path: `ops/datasources/${encodeURIComponent(id)}`,
    method: 'PATCH',
    forwardBody: true,
  });
}
