import { z } from 'zod';

/**
 * KPX 지역별 시간별 태양광 발전량 row (getPvAmountByLocHr).
 * 실응답 검증: data/samples/pv-gen-20251231-full.json (2026-07-03).
 * 숫자가 number 또는 string으로 섞여 올 수 있어 coerce한다.
 */
const KpxNumberLikeSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { message: 'Expected a finite number' });

const KpxIntegerLikeSchema = KpxNumberLikeSchema.refine((value) => Number.isInteger(value), {
  message: 'Expected an integer',
});

export const KpxPvGenerationRowSchema = z.object({
  // 거래시간 1..24 베이스 (tradeNo N = KST [N-1시, N시) 구간) — 실응답 확정.
  tradeNo: KpxIntegerLikeSchema.refine((value) => value >= 1 && value <= 24, {
    message: 'tradeNo must be 1..24',
  }),
  tradeYmd: z.string().regex(/^\d{8}$/),
  regionNm: z.string().trim().min(1),
  // 발전량 MWh, 소수 6자리.
  amgo: KpxNumberLikeSchema.refine((value) => value >= 0, {
    message: 'amgo must be non-negative',
  }),
  rn: KpxIntegerLikeSchema.optional(),
});

export const KpxPvGenerationRowsSchema = z.array(KpxPvGenerationRowSchema);

export type KpxPvGenerationRow = z.infer<typeof KpxPvGenerationRowSchema>;
