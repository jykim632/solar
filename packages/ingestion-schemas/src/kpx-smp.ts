import { z } from 'zod';

/**
 * KPX 계통한계가격 및 수요예측(하루전 발전계획용) row
 * (SmpWithForecastDemand/getSmpWithForecastDemand).
 * 실응답 검증: data/samples/kpx-smp-latest.json (2026-07-04).
 *
 * dataset 15131225 — 구 계통한계가격조회(15076302, 삭제예정)의 운영 대체(§5.5 1순위).
 * hour는 거래시간 1..24(N = KST [N-1시, N시) 구간). areaName '육지'/'제주'.
 * smp 단위 원/kWh. slfd/jlfd/mlfd(수요예측)는 SMP mart 대상 아님 — 무시.
 */
const KpxNumberLikeSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { message: 'Expected a finite number' });

const KpxIntegerLikeSchema = KpxNumberLikeSchema.refine((value) => Number.isInteger(value), {
  message: 'Expected an integer',
});

export const KpxSmpRowSchema = z.object({
  date: z.string().regex(/^\d{8}$/, 'date must be YYYYMMDD'),
  hour: KpxIntegerLikeSchema.refine((value) => value >= 1 && value <= 24, {
    message: 'hour must be 1..24',
  }),
  areaName: z.string().trim().min(1),
  smp: KpxNumberLikeSchema.refine((value) => value >= 0, { message: 'smp must be non-negative' }),
  rn: KpxIntegerLikeSchema.optional(),
});

export const KpxSmpRowsSchema = z.array(KpxSmpRowSchema);

export type KpxSmpRow = z.infer<typeof KpxSmpRowSchema>;
