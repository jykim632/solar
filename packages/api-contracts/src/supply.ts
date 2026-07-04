import { z } from 'zod';
import { IsoInstantSchema } from './generation';

/**
 * GET /api/v1/supply/realtime 계약 (§11.1, solar-r32.3).
 * mart_supply_realtime는 공공 집계값(organization scope 없음). 실시간 5분 슬롯이라
 * 발전량과 달리 지연이 없어 "최근 N시간" 고정창 + 최신 스냅샷만 반환한다 —
 * cursor 페이지네이션 불필요(하루 288슬롯이 limit 안에 들어옴).
 */
export const SupplyRealtimeQuerySchema = z.object({
  // 조회 창 길이(시간). 기본 24h = 최근 288슬롯.
  hours: z.coerce.number().int().min(1).max(168).default(24),
});
export type SupplyRealtimeQuery = z.infer<typeof SupplyRealtimeQuerySchema>;

export const SupplyRealtimeItemSchema = z.object({
  slotAt: IsoInstantSchema,
  supplyAbilityMw: z.number().nullable(),
  currentDemandMw: z.number().nullable(),
  forecastLoadMw: z.number().nullable(),
  reservePowerMw: z.number().nullable(),
  reserveRatePct: z.number().nullable(),
  operatingReservePowerMw: z.number().nullable(),
  operatingReserveRatePct: z.number().nullable(),
});
export type SupplyRealtimeItem = z.infer<typeof SupplyRealtimeItemSchema>;

export const SupplyRealtimeMetaSchema = z.object({
  timezone: z.literal('Asia/Seoul'),
  hours: z.number().int().min(1).max(168),
  // 수집된 최신 슬롯 시각(없으면 null). KPI 카드의 "기준시각".
  latestSlotAt: IsoInstantSchema.nullable(),
  count: z.number().int().min(0),
});
export type SupplyRealtimeMeta = z.infer<typeof SupplyRealtimeMetaSchema>;

export const SupplyRealtimeResponseSchema = z.object({
  items: z.array(SupplyRealtimeItemSchema),
  meta: SupplyRealtimeMetaSchema,
});
export type SupplyRealtimeResponse = z.infer<typeof SupplyRealtimeResponseSchema>;
