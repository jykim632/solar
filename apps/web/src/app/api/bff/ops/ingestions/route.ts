import { proxyApiRequest } from '@/lib/bff-proxy';

export const runtime = 'nodejs';

/**
 * 수집 수동 실행 (solar-up3). NestJS가 worker ingest를 동기 실행하므로
 * 응답까지 수십 초 걸릴 수 있다 — 첫 POST proxy.
 */
export async function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, {
    path: 'ops/ingestions',
    method: 'POST',
    forwardBody: true,
  });
}
