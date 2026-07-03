import { z } from 'zod';
import { IsoDateSchema } from './common';

/**
 * GET /api/v1/market/rec/daily 계약 (§10, solar-r32.5).
 * mart는 LAND/JEJU/TOTAL 3행 fan-out — SMP의 MarketAreaSchema(LAND/JEJU)와
 * 별개로 TOTAL을 포함한 REC 전용 enum을 둔다.
 */
export const RecMarketAreaSchema = z.enum(['LAND', 'JEJU', 'TOTAL']);
export type RecMarketArea = z.infer<typeof RecMarketAreaSchema>;

export const RecDailyQuerySchema = z.object({
  area: RecMarketAreaSchema.optional(),
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(400).default(100),
});
export type RecDailyQuery = z.infer<typeof RecDailyQuerySchema>;

export const RecDailyItemSchema = z.object({
  tradeDate: IsoDateSchema,
  marketArea: RecMarketAreaSchema,
  closePriceKrwPerRec: z.number().nullable(),
  avgPriceKrwPerRec: z.number().nullable(),
  highPriceKrwPerRec: z.number().nullable(),
  lowPriceKrwPerRec: z.number().nullable(),
  volumeRec: z.number().nullable(),
  tradeCount: z.number().int().nullable(),
  totalTradeAmountKrw: z.number().nullable(),
});
export type RecDailyItem = z.infer<typeof RecDailyItemSchema>;

export const RecDailyMetaSchema = z.object({
  bucket: z.literal('daily'),
  from: IsoDateSchema,
  to: IsoDateSchema,
  timezone: z.literal('Asia/Seoul'),
  rangeDays: z.number().int().min(1),
  limit: z.number().int().min(1).max(400),
  defaultedFrom: z.boolean(),
  defaultedTo: z.boolean(),
  maxRangeDays: z.number().int().min(1),
});
export type RecDailyMeta = z.infer<typeof RecDailyMetaSchema>;

export const RecDailyResponseSchema = z.object({
  items: z.array(RecDailyItemSchema),
  nextCursor: z.string().nullable(),
  meta: RecDailyMetaSchema,
});
export type RecDailyResponse = z.infer<typeof RecDailyResponseSchema>;
