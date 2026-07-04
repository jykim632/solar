import { z } from 'zod';
import { IsoDateSchema, MarketAreaSchema } from './common';
import { IsoInstantSchema } from './generation';

/**
 * GET /api/v1/market/smp/hourly 계약 (§10, solar-r32.7).
 * 소스는 하루전 발전계획용 SMP(dataset 15131225, solar-2af.6) — 미래 일자
 * (내일)까지 포함될 수 있고, 실시간 정산 SMP가 아니다. hourly 전용
 * (다운샘플링 없음 — 시간별 가격 자체가 화면 단위).
 */
export const SmpHourlyQuerySchema = z.object({
  area: MarketAreaSchema.optional(),
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type SmpHourlyQuery = z.infer<typeof SmpHourlyQuerySchema>;

export const SmpHourlyItemSchema = z.object({
  intervalStartAt: IsoInstantSchema,
  marketArea: MarketAreaSchema,
  smpKrwPerKwh: z.number(),
});
export type SmpHourlyItem = z.infer<typeof SmpHourlyItemSchema>;

export const SmpHourlyMetaSchema = z.object({
  bucket: z.literal('hourly'),
  from: IsoDateSchema,
  to: IsoDateSchema,
  timezone: z.literal('Asia/Seoul'),
  rangeDays: z.number().int().min(1),
  limit: z.number().int().min(1).max(1000),
  defaultedFrom: z.boolean(),
  defaultedTo: z.boolean(),
  latestAvailableSourceDate: IsoDateSchema.nullable(),
  maxRangeDays: z.number().int().min(1),
});
export type SmpHourlyMeta = z.infer<typeof SmpHourlyMetaSchema>;

export const SmpHourlyResponseSchema = z.object({
  items: z.array(SmpHourlyItemSchema),
  nextCursor: z.string().nullable(),
  meta: SmpHourlyMetaSchema,
});
export type SmpHourlyResponse = z.infer<typeof SmpHourlyResponseSchema>;
