import { proxyApiRequest } from '@/lib/bff-proxy';

export const runtime = 'nodejs';

/** 수집 관리 — datasource 목록 + 최근 run/quality 요약 (solar-up3). */
export async function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, { path: 'ops/datasources' });
}
