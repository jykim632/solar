import { Inject, Injectable } from '@nestjs/common';
import type {
  RecDailyItem,
  RecDailyQuery,
  RecDailyResponse,
  RecMarketArea,
} from '@solar/api-contracts';
import type { Db } from '@solar/db';
import { martRecMarketDaily } from '@solar/db/schema';
import { and, asc, eq, gt, gte, lte, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { encodeRecDailyCursor, type RecDailyCursor } from '../timeseries/cursor';
import { KST_TIMEZONE } from '../timeseries/kst';
import {
  buildRecDailyQueryPlan,
  REC_MAX_RANGE_DAYS,
  type RecDailyQueryPlan,
} from '../timeseries/query-plan';
import { throwTimeseriesBadRequest } from '../timeseries/timeseries-http-error';

type RecDailyRow = {
  tradeDate: string;
  marketArea: string;
  closePriceKrwPerRec: string | null;
  avgPriceKrwPerRec: string | null;
  highPriceKrwPerRec: string | null;
  lowPriceKrwPerRec: string | null;
  volumeRec: string | null;
  tradeCount: number | null;
  totalTradeAmountKrw: string | null;
};

@Injectable()
export class RecService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getDaily(query: RecDailyQuery): Promise<RecDailyResponse> {
    const plan = this.toPlan(query);
    const rows = await this.selectRows(plan);
    const pageRows = rows.slice(0, plan.limit);
    const nextCursor =
      rows.length > plan.limit
        ? encodeRecDailyCursor({
            tradeDate: lastOrThrow(pageRows).tradeDate,
            marketArea: lastOrThrow(pageRows).marketArea as RecMarketArea,
          })
        : null;

    return {
      items: pageRows.map((row) => this.toItem(row)),
      nextCursor,
      meta: {
        bucket: 'daily',
        from: plan.from,
        to: plan.to,
        timezone: KST_TIMEZONE,
        rangeDays: plan.rangeDays,
        limit: plan.limit,
        defaultedFrom: plan.defaultedFrom,
        defaultedTo: plan.defaultedTo,
        maxRangeDays: REC_MAX_RANGE_DAYS,
      },
    };
  }

  private toPlan(query: RecDailyQuery): RecDailyQueryPlan {
    try {
      return buildRecDailyQueryPlan(query);
    } catch (error) {
      throwTimeseriesBadRequest(error);
    }
  }

  private async selectRows(plan: RecDailyQueryPlan): Promise<RecDailyRow[]> {
    const conditions: SQL<unknown>[] = [
      gte(martRecMarketDaily.tradeDate, plan.from),
      lte(martRecMarketDaily.tradeDate, plan.to),
    ];

    if (plan.area !== undefined) {
      conditions.push(eq(martRecMarketDaily.marketArea, plan.area));
    }

    const cursorCondition = recCursorCondition(plan.cursor);
    if (cursorCondition !== undefined) {
      conditions.push(cursorCondition);
    }

    // 공공데이터 집계 mart — organization_id scope 없음. datasource는
    // MVP에서 1개 seed(복수 소스 지원 전까지 필터 없음).
    return this.db
      .select({
        tradeDate: martRecMarketDaily.tradeDate,
        marketArea: martRecMarketDaily.marketArea,
        closePriceKrwPerRec: martRecMarketDaily.closePriceKrwPerRec,
        avgPriceKrwPerRec: martRecMarketDaily.avgPriceKrwPerRec,
        highPriceKrwPerRec: martRecMarketDaily.highPriceKrwPerRec,
        lowPriceKrwPerRec: martRecMarketDaily.lowPriceKrwPerRec,
        volumeRec: martRecMarketDaily.volumeRec,
        tradeCount: martRecMarketDaily.tradeCount,
        totalTradeAmountKrw: martRecMarketDaily.totalTradeAmountKrw,
      })
      .from(martRecMarketDaily)
      .where(and(...conditions))
      .orderBy(asc(martRecMarketDaily.tradeDate), asc(martRecMarketDaily.marketArea))
      .limit(plan.limit + 1);
  }

  // 대량 결과라 row별 zod .parse() 금지(§10) — 직접 매핑만.
  private toItem(row: RecDailyRow): RecDailyItem {
    return {
      tradeDate: row.tradeDate,
      marketArea: row.marketArea as RecDailyItem['marketArea'],
      closePriceKrwPerRec: nullableNumber(row.closePriceKrwPerRec),
      avgPriceKrwPerRec: nullableNumber(row.avgPriceKrwPerRec),
      highPriceKrwPerRec: nullableNumber(row.highPriceKrwPerRec),
      lowPriceKrwPerRec: nullableNumber(row.lowPriceKrwPerRec),
      volumeRec: nullableNumber(row.volumeRec),
      tradeCount: row.tradeCount,
      totalTradeAmountKrw: nullableNumber(row.totalTradeAmountKrw),
    };
  }
}

function recCursorCondition(cursor: RecDailyCursor | null): SQL<unknown> | undefined {
  if (cursor === null) {
    return undefined;
  }

  return or(
    gt(martRecMarketDaily.tradeDate, cursor.tradeDate),
    and(
      eq(martRecMarketDaily.tradeDate, cursor.tradeDate),
      gt(martRecMarketDaily.marketArea, cursor.marketArea),
    ),
  );
}

function nullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function lastOrThrow<T>(items: readonly T[]): T {
  const item = items[items.length - 1];

  if (item === undefined) {
    throw new Error('Expected at least one paginated row.');
  }

  return item;
}
