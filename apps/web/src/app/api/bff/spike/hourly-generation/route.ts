import { ApiErrorCode } from '@solar/api-contracts';
import { auth } from '@/lib/auth';
import { DEMO_ORGANIZATION_ID } from '@/lib/query-keys';
import {
  SpikeHourlyGenerationResponseSchema,
  type SpikeHourlyGenerationPoint,
} from '@/app/(app)/spike/spike-schemas';

export const runtime = 'nodejs';

/**
 * 스파이크용 BFF route (solar-8wv.13). 실데이터 API가 생기기 전까지 정적
 * 샘플을 반환한다 — fetch 래퍼/차트/캐시 규약 검증용. NestJS 프록시 패턴은
 * /api/bff/me 참조.
 */
const samplePoints = [
  { hour: '00:00', generationKwh: 0 },
  { hour: '01:00', generationKwh: 0 },
  { hour: '02:00', generationKwh: 0 },
  { hour: '03:00', generationKwh: 0 },
  { hour: '04:00', generationKwh: 3 },
  { hour: '05:00', generationKwh: 18 },
  { hour: '06:00', generationKwh: 62 },
  { hour: '07:00', generationKwh: 124 },
  { hour: '08:00', generationKwh: 196 },
  { hour: '09:00', generationKwh: 258 },
  { hour: '10:00', generationKwh: 306 },
  { hour: '11:00', generationKwh: 338 },
  { hour: '12:00', generationKwh: 351 },
  { hour: '13:00', generationKwh: 344 },
  { hour: '14:00', generationKwh: 318 },
  { hour: '15:00', generationKwh: 270 },
  { hour: '16:00', generationKwh: 205 },
  { hour: '17:00', generationKwh: 132 },
  { hour: '18:00', generationKwh: 58 },
  { hour: '19:00', generationKwh: 14 },
  { hour: '20:00', generationKwh: 0 },
  { hour: '21:00', generationKwh: 0 },
  { hour: '22:00', generationKwh: 0 },
  { hour: '23:00', generationKwh: 0 },
] satisfies SpikeHourlyGenerationPoint[];

export async function GET(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json(
      { code: ApiErrorCode.UNAUTHORIZED, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const body = SpikeHourlyGenerationResponseSchema.parse({
    organizationId: DEMO_ORGANIZATION_ID,
    points: samplePoints,
  });

  return Response.json(body, {
    status: 200,
    headers: { 'cache-control': 'no-store' },
  });
}
