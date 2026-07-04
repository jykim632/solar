import { proxyApiRequest } from '@/lib/bff-proxy';

export const runtime = 'nodejs';

/** 수집 관리 — 최근 ops_ingestion_run 목록 (solar-up3). */
export async function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, {
    path: 'ops/runs',
    forwardParams: ['datasource', 'limit'],
  });
}
