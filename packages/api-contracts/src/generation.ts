import { z } from 'zod';
import { FuelTypeSchema, IsoDateSchema } from './common';

/**
 * GET /api/v1/generation/hourly 계약 (§10, solar-r32.5).
 * raw hourly는 31일까지, 그 이상은 bucket=daily 명시 필수(암묵 다운샘플링
 * 대신 400 — 차트 의미와 cursor 종류가 달라지므로 호출자가 선택).
 */
export const IsoInstantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, 'expected ISO-8601 UTC instant');

export const GenerationBucketSchema = z.enum(['hourly', 'daily']);
export type GenerationBucket = z.infer<typeof GenerationBucketSchema>;

export const GenerationHourlyQuerySchema = z.object({
  region: z.string().trim().min(1).max(64).optional(),
  fuelType: FuelTypeSchema.default('SOLAR'),
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  bucket: GenerationBucketSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type GenerationHourlyQuery = z.infer<typeof GenerationHourlyQuerySchema>;

export const GenerationHourlyItemSchema = z.object({
  intervalStartAt: IsoInstantSchema,
  regionCode: z.string(),
  fuelType: FuelTypeSchema,
  generationMwh: z.number(),
});
export type GenerationHourlyItem = z.infer<typeof GenerationHourlyItemSchema>;

export const GenerationHourlyMetaSchema = z.object({
  bucket: GenerationBucketSchema,
  from: IsoDateSchema,
  to: IsoDateSchema,
  timezone: z.literal('Asia/Seoul'),
  rangeDays: z.number().int().min(1),
  limit: z.number().int().min(1).max(1000),
  defaultedFrom: z.boolean(),
  defaultedTo: z.boolean(),
  latestAvailableSourceDate: IsoDateSchema.nullable(),
  maxRawRangeDays: z.number().int().min(1),
});
export type GenerationHourlyMeta = z.infer<typeof GenerationHourlyMetaSchema>;

export const GenerationHourlyResponseSchema = z.object({
  items: z.array(GenerationHourlyItemSchema),
  nextCursor: z.string().nullable(),
  meta: GenerationHourlyMetaSchema,
});
export type GenerationHourlyResponse = z.infer<typeof GenerationHourlyResponseSchema>;
