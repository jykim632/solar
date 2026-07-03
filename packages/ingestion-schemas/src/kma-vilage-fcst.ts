import { z } from 'zod';

/**
 * KMA 단기예보 getVilageFcst row.
 * 실응답 검증: data/samples/fcst-vilage-2026-07-03.json (2026-07-03).
 *
 * fcstValue는 의도적으로 string 유지 — 숫자와 한국어 버킷 라벨("강수없음",
 * "1.0mm 미만")이 섞여 온다. 숫자 변환은 adapter transform에서 category별로.
 */
const KmaNumberLikeSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { message: 'Expected a finite number' });

const KmaNonNegativeIntegerSchema = KmaNumberLikeSchema.refine(
  (value) => Number.isInteger(value) && value >= 0,
  { message: 'Expected a non-negative integer' },
);

const KmaYmdSchema = z.string().regex(/^\d{8}$/);

const KmaHmSchema = z
  .string()
  .regex(/^\d{4}$/)
  .refine(
    (value) => {
      const hour = Number(value.slice(0, 2));
      const minute = Number(value.slice(2, 4));

      return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    },
    { message: 'Expected HHMM time' },
  );

const KmaFcstValueSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => value.length > 0, { message: 'Expected a non-empty fcstValue' });

export const KmaVilageFcstCategorySchema = z.enum([
  'TMP',
  'UUU',
  'VVV',
  'VEC',
  'WSD',
  'SKY',
  'PTY',
  'POP',
  'WAV',
  'PCP',
  'REH',
  'SNO',
  'TMN',
  'TMX',
]);

export const KmaVilageFcstRowSchema = z.object({
  baseDate: KmaYmdSchema,
  baseTime: KmaHmSchema,
  category: KmaVilageFcstCategorySchema,
  fcstDate: KmaYmdSchema,
  fcstTime: KmaHmSchema,
  fcstValue: KmaFcstValueSchema,
  nx: KmaNonNegativeIntegerSchema,
  ny: KmaNonNegativeIntegerSchema,
});

export const KmaVilageFcstRowsSchema = z.array(KmaVilageFcstRowSchema);

export type KmaVilageFcstCategory = z.infer<typeof KmaVilageFcstCategorySchema>;
export type KmaVilageFcstRow = z.infer<typeof KmaVilageFcstRowSchema>;
