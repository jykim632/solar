import { z } from 'zod';

/**
 * KPX 현재전력수급현황 5분 슬롯 row (Sukub5mToday/getSukub5mToday).
 * 실응답 검증: data/samples/kpx-supply-latest.json (2026-07-04).
 *
 * 이 API는 구 현재전력수급현황조회(15056640)의 신규 대체(_GW, 15158704).
 * baseDatetime은 KST YYYYMMDDHHMMSS(초 포함, 5분 정렬). 수치는 number로
 * 오지만 방어적으로 coerce한다. forecastLoad는 실측 구간에서 0.0으로 옴
 * (미래 예보값 아님) — staging에서 0을 null 처리한다.
 */
const KpxNumberLikeSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { message: 'Expected a finite number' });

export const KpxSupplyRowSchema = z.object({
  baseDatetime: z.string().regex(/^\d{14}$/, 'baseDatetime must be YYYYMMDDHHMMSS'),
  suppAbility: KpxNumberLikeSchema,
  currPwrTot: KpxNumberLikeSchema,
  forecastLoad: KpxNumberLikeSchema,
  suppReservePwr: KpxNumberLikeSchema,
  suppReserveRate: KpxNumberLikeSchema,
  operReservePwr: KpxNumberLikeSchema,
  operReserveRate: KpxNumberLikeSchema,
  rn: KpxNumberLikeSchema.optional(),
});

export const KpxSupplyRowsSchema = z.array(KpxSupplyRowSchema);

export type KpxSupplyRow = z.infer<typeof KpxSupplyRowSchema>;
