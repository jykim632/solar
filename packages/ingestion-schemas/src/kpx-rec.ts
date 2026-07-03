import { z } from 'zod';

/**
 * KPX REC 현물시장 row (getRecMarketInfo2).
 * 실응답 검증: data/samples/rec-latest-2026-07-03.json (2026-07-03).
 * clsPrc는 육지 기준 종가로 관측됨(제주 가격은 jeju* 필드 별도) — §6.3 주석 참조.
 */
const KpxNumberLikeSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { message: 'Expected a finite number' });

const NonNegativeNumberSchema = KpxNumberLikeSchema.refine((value) => value >= 0, {
  message: 'Expected a non-negative number',
});

const NonNegativeIntegerSchema = NonNegativeNumberSchema.refine(
  (value) => Number.isInteger(value),
  { message: 'Expected an integer' },
);

export const KpxRecMarketRowSchema = z.object({
  bzDd: z.string().regex(/^\d{8}$/),
  clsPrc: NonNegativeNumberSchema,

  landAvgPrc: NonNegativeNumberSchema,
  landHgPrc: NonNegativeNumberSchema,
  landLwPrc: NonNegativeNumberSchema,
  landUplmtPrc: NonNegativeNumberSchema,
  landLwlmtPrc: NonNegativeNumberSchema,
  landOrdCnt: NonNegativeIntegerSchema,
  landOrdRecValue: NonNegativeNumberSchema,
  landTrdCnt: NonNegativeIntegerSchema,
  landTrdRecValue: NonNegativeNumberSchema,

  jejuAvgPrc: NonNegativeNumberSchema,
  jejuHgPrc: NonNegativeNumberSchema,
  jejuLwPrc: NonNegativeNumberSchema,
  jejuUplmtPrc: NonNegativeNumberSchema,
  jejuLwlmtPrc: NonNegativeNumberSchema,
  jejuOrdCnt: NonNegativeIntegerSchema,
  jejuOrdRecValue: NonNegativeNumberSchema,
  jejuTrdCnt: NonNegativeIntegerSchema,
  jejuTrdRecValue: NonNegativeNumberSchema,

  totCnt: NonNegativeIntegerSchema,
  totRecValue: NonNegativeNumberSchema,
  trdCnt: NonNegativeIntegerSchema,
  trdRecValue: NonNegativeNumberSchema,
  bidTrdVal: NonNegativeNumberSchema,
  rn: NonNegativeIntegerSchema.optional(),
});

export const KpxRecMarketRowsSchema = z.array(KpxRecMarketRowSchema);

export type KpxRecMarketRow = z.infer<typeof KpxRecMarketRowSchema>;
