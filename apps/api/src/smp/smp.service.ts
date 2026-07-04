import { Inject, Injectable } from '@nestjs/common';
import type {
  MarketArea,
  SmpHourlyItem,
  SmpHourlyQuery,
  SmpHourlyResponse,
} from '@solar/api-contracts';
import type { Db } from '@solar/db';
import { martSmpHourly } from '@solar/db/schema';
import { and, asc, desc, eq, gt, gte, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { encodeSmpHourlyCursor, type SmpHourlyCursor } from '../timeseries/cursor';
import { KST_TIMEZONE } from '../timeseries/kst';
import {
  buildSmpHourlyQueryPlan,
  SMP_MAX_RANGE_DAYS,
  type SmpHourlyQueryPlan,
} from '../timeseries/query-plan';
import { throwTimeseriesBadRequest } from '../timeseries/timeseries-http-error';

type SmpHourlyRow = {
  intervalStartAt: Date;
  marketArea: string;
  smpKrwPerKwh: string;
};

@Injectable()
export class SmpService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getHourly(query: SmpHourlyQuery): Promise<SmpHourlyResponse> {
    const latestSourceDate = await this.getLatestSourceDate(query.area);
    const plan = this.toPlan(query, latestSourceDate);
    const rows = await this.selectRows(plan);
    const pageRows = rows.slice(0, plan.limit);
    const nextCursor =
      rows.length > plan.limit
        ? encodeSmpHourlyCursor({
            intervalStartAt: lastOrThrow(pageRows).intervalStartAt.toISOString(),
            marketArea: lastOrThrow(pageRows).marketArea as MarketArea,
          })
        : null;

    return {
      items: pageRows.map((row) => this.toItem(row)),
      nextCursor,
      meta: {
        bucket: 'hourly',
        from: plan.from,
        to: plan.to,
        timezone: KST_TIMEZONE,
        rangeDays: plan.rangeDays,
        limit: plan.limit,
        defaultedFrom: plan.defaultedFrom,
        defaultedTo: plan.defaultedTo,
        latestAvailableSourceDate: plan.latestAvailableSourceDate,
        maxRangeDays: SMP_MAX_RANGE_DAYS,
      },
    };
  }

  private toPlan(query: SmpHourlyQuery, latestSourceDate: string | null): SmpHourlyQueryPlan {
    try {
      return buildSmpHourlyQueryPlan(query, latestSourceDate);
    } catch (error) {
      throwTimeseriesBadRequest(error);
    }
  }

  private async getLatestSourceDate(area: MarketArea | undefined): Promise<string | null> {
    // 하루전 예측 소스라 육지가 제주보다 먼저 게시될 수 있다(generation의
    // solar-04l과 동일 패턴). area 미지정 기본 창은 두 시장을 모두 채운
    // 최신 일자에 앵커하고, area 지정 시 해당 시장의 max(source_date)를 쓴다.
    if (area !== undefined) {
      const [row] = await this.db
        .select({
          latestSourceDate: sql<string | null>`max(${martSmpHourly.sourceDate})`,
        })
        .from(martSmpHourly)
        .where(eq(martSmpHourly.marketArea, area));

      return row?.latestSourceDate ?? null;
    }

    const observedAreaCount = this.db
      .select({ value: sql`count(distinct ${martSmpHourly.marketArea})` })
      .from(martSmpHourly);

    const [row] = await this.db
      .select({ latestSourceDate: martSmpHourly.sourceDate })
      .from(martSmpHourly)
      .groupBy(martSmpHourly.sourceDate)
      .having(sql`count(distinct ${martSmpHourly.marketArea}) = (${observedAreaCount})`)
      .orderBy(desc(martSmpHourly.sourceDate))
      .limit(1);

    return row?.latestSourceDate ?? null;
  }

  private async selectRows(plan: SmpHourlyQueryPlan): Promise<SmpHourlyRow[]> {
    const conditions: SQL<unknown>[] = [
      gte(martSmpHourly.intervalStartAt, plan.fromUtc),
      lt(martSmpHourly.intervalStartAt, plan.toExclusiveUtc),
    ];

    if (plan.area !== undefined) {
      conditions.push(eq(martSmpHourly.marketArea, plan.area));
    }

    const cursorCondition = smpCursorCondition(plan.cursor);
    if (cursorCondition !== undefined) {
      conditions.push(cursorCondition);
    }

    // 공공데이터 집계 mart — organization_id scope 없음. datasource는
    // MVP에서 1개 seed(복수 소스 지원 전까지 필터 없음).
    return this.db
      .select({
        intervalStartAt: martSmpHourly.intervalStartAt,
        marketArea: martSmpHourly.marketArea,
        smpKrwPerKwh: martSmpHourly.smpKrwPerKwh,
      })
      .from(martSmpHourly)
      .where(and(...conditions))
      .orderBy(asc(martSmpHourly.intervalStartAt), asc(martSmpHourly.marketArea))
      .limit(plan.limit + 1);
  }

  // 대량 결과라 row별 zod .parse() 금지(§10) — 직접 매핑만.
  private toItem(row: SmpHourlyRow): SmpHourlyItem {
    return {
      intervalStartAt: row.intervalStartAt.toISOString(),
      marketArea: row.marketArea as SmpHourlyItem['marketArea'],
      smpKrwPerKwh: Number(row.smpKrwPerKwh),
    };
  }
}

function smpCursorCondition(cursor: SmpHourlyCursor | null): SQL<unknown> | undefined {
  if (cursor === null) {
    return undefined;
  }

  const intervalStartAt = new Date(cursor.intervalStartAt);

  return or(
    gt(martSmpHourly.intervalStartAt, intervalStartAt),
    and(
      eq(martSmpHourly.intervalStartAt, intervalStartAt),
      gt(martSmpHourly.marketArea, cursor.marketArea),
    ),
  );
}

function lastOrThrow<T>(items: readonly T[]): T {
  const item = items[items.length - 1];

  if (item === undefined) {
    throw new Error('Expected at least one paginated row.');
  }

  return item;
}
