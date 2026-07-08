import { Inject, Injectable } from '@nestjs/common';
import type { SupplyRealtimeItem, SupplyRealtimeQuery, SupplyRealtimeResponse } from '@solar/api-contracts';
import type { Db } from '@solar/db';
import { martSupplyRealtime } from '@solar/db/schema';
import { and, asc, desc, gte } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { KST_TIMEZONE } from '../timeseries/kst';

type SupplyRow = {
  slotAt: Date;
  supplyAbilityMw: string | null;
  currentDemandMw: string | null;
  forecastLoadMw: string | null;
  reservePowerMw: string | null;
  reserveRatePct: string | null;
  operatingReservePowerMw: string | null;
  operatingReserveRatePct: string | null;
};

@Injectable()
export class SupplyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getRealtime(query: SupplyRealtimeQuery): Promise<SupplyRealtimeResponse> {
    // 최신 슬롯을 앵커로 잡고 그 이전 hours시간 창을 조회한다. 실시간 API라
    // 지연이 없어 "지금"이 아니라 "수집된 최신"을 기준으로 창을 연다 —
    // 스케줄 실행 간격 동안 새 슬롯이 없어도 항상 최근 데이터를 보여준다.
    const [latest] = await this.db
      .select({ slotAt: martSupplyRealtime.slotAt })
      .from(martSupplyRealtime)
      .orderBy(desc(martSupplyRealtime.slotAt))
      .limit(1);

    if (!latest) {
      return {
        items: [],
        meta: { timezone: KST_TIMEZONE, hours: query.hours, latestSlotAt: null, count: 0 },
      };
    }

    const windowStartUtc = new Date(latest.slotAt.getTime() - query.hours * 60 * 60 * 1000);

    // 공공데이터 집계 mart — organization_id scope 없음(§10.3). datasource는
    // MVP에서 1개 seed(복수 소스 지원 전까지 필터 없음).
    const rows = await this.db
      .select({
        slotAt: martSupplyRealtime.slotAt,
        supplyAbilityMw: martSupplyRealtime.supplyAbilityMw,
        currentDemandMw: martSupplyRealtime.currentDemandMw,
        forecastLoadMw: martSupplyRealtime.forecastLoadMw,
        reservePowerMw: martSupplyRealtime.reservePowerMw,
        reserveRatePct: martSupplyRealtime.reserveRatePct,
        operatingReservePowerMw: martSupplyRealtime.operatingReservePowerMw,
        operatingReserveRatePct: martSupplyRealtime.operatingReserveRatePct,
      })
      .from(martSupplyRealtime)
      .where(and(gte(martSupplyRealtime.slotAt, windowStartUtc)))
      .orderBy(asc(martSupplyRealtime.slotAt));

    return {
      items: rows.map((row) => this.toItem(row)),
      meta: {
        timezone: KST_TIMEZONE,
        hours: query.hours,
        latestSlotAt: latest.slotAt.toISOString(),
        count: rows.length,
      },
    };
  }

  // 대량 결과라 row별 zod .parse() 금지(§10) — 직접 매핑만.
  private toItem(row: SupplyRow): SupplyRealtimeItem {
    return {
      slotAt: row.slotAt.toISOString(),
      supplyAbilityMw: nullableNumber(row.supplyAbilityMw),
      currentDemandMw: nullableNumber(row.currentDemandMw),
      forecastLoadMw: nullableNumber(row.forecastLoadMw),
      reservePowerMw: nullableNumber(row.reservePowerMw),
      reserveRatePct: nullableNumber(row.reserveRatePct),
      operatingReservePowerMw: nullableNumber(row.operatingReservePowerMw),
      operatingReserveRatePct: nullableNumber(row.operatingReserveRatePct),
    };
  }
}

function nullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}
