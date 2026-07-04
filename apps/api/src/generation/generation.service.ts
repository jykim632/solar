import { Inject, Injectable } from '@nestjs/common';
import type {
  FuelType,
  GenerationHourlyItem,
  GenerationHourlyQuery,
  GenerationHourlyResponse,
} from '@solar/api-contracts';
import type { Db } from '@solar/db';
import { martGenerationHourly } from '@solar/db/schema';
import { and, asc, desc, eq, gt, gte, lt, lte, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DB } from '../db/db.module';
import {
  encodeGenerationDailyCursor,
  encodeGenerationHourlyCursor,
  type GenerationDailyCursor,
  type GenerationHourlyCursor,
} from '../timeseries/cursor';
import { isoDateToKstStartUtcDate, KST_TIMEZONE } from '../timeseries/kst';
import {
  buildGenerationQueryPlan,
  GENERATION_RAW_MAX_RANGE_DAYS,
  type GenerationDailyQueryPlan,
  type GenerationHourlyQueryPlan,
  type GenerationQueryPlan,
} from '../timeseries/query-plan';
import { throwTimeseriesBadRequest } from '../timeseries/timeseries-http-error';

type GenerationHourlyRow = {
  intervalStartAt: Date;
  regionCode: string;
  fuelType: string;
  generationMwh: string;
};

type GenerationDailyRow = {
  sourceDate: string;
  regionCode: string;
  fuelType: string;
  generationMwh: string | null;
};

@Injectable()
export class GenerationService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getHourly(query: GenerationHourlyQuery): Promise<GenerationHourlyResponse> {
    const latestSourceDate = await this.getLatestSourceDate(query.fuelType);
    const plan = this.toPlan(query, latestSourceDate);

    if (plan.bucket === 'daily') {
      const rows = await this.selectDailyRows(plan);
      const pageRows = rows.slice(0, plan.limit);
      const nextCursor =
        rows.length > plan.limit
          ? encodeGenerationDailyCursor({
              sourceDate: lastOrThrow(pageRows).sourceDate,
              regionCode: lastOrThrow(pageRows).regionCode,
            })
          : null;

      return {
        items: pageRows.map((row) => this.toDailyItem(row)),
        nextCursor,
        meta: this.toMeta(plan),
      };
    }

    const rows = await this.selectHourlyRows(plan);
    const pageRows = rows.slice(0, plan.limit);
    const nextCursor =
      rows.length > plan.limit
        ? encodeGenerationHourlyCursor({
            intervalStartAt: lastOrThrow(pageRows).intervalStartAt.toISOString(),
            regionCode: lastOrThrow(pageRows).regionCode,
          })
        : null;

    return {
      items: pageRows.map((row) => this.toHourlyItem(row)),
      nextCursor,
      meta: this.toMeta(plan),
    };
  }

  private toPlan(
    query: GenerationHourlyQuery,
    latestSourceDate: string | null,
  ): GenerationQueryPlan {
    try {
      return buildGenerationQueryPlan(query, latestSourceDate);
    } catch (error) {
      throwTimeseriesBadRequest(error);
    }
  }

  private async getLatestSourceDate(fuelType: FuelType): Promise<string | null> {
    // KPX가 최신 구간을 일부 지역만 먼저 게시할 수 있어(solar-04l: 5월 말
    // JEJU 단독) 단순 max(source_date) 앵커는 지도 스냅샷을 부분 커버리지
    // 일자에 고정시킨다. 해당 fuel_type에서 관측된 전체 지역 수를 채운
    // 최신 일자를 앵커로 쓴다 — 명시적 from/to 조회는 부분 일자도 그대로 조회된다.
    const observedRegionCount = this.db
      .select({
        value: sql`count(distinct ${martGenerationHourly.regionCode})`,
      })
      .from(martGenerationHourly)
      .where(eq(martGenerationHourly.fuelType, fuelType));

    const [row] = await this.db
      .select({ latestSourceDate: martGenerationHourly.sourceDate })
      .from(martGenerationHourly)
      .where(eq(martGenerationHourly.fuelType, fuelType))
      .groupBy(martGenerationHourly.sourceDate)
      .having(
        sql`count(distinct ${martGenerationHourly.regionCode}) = (${observedRegionCount})`,
      )
      .orderBy(desc(martGenerationHourly.sourceDate))
      .limit(1);

    return row?.latestSourceDate ?? null;
  }

  private async selectHourlyRows(plan: GenerationHourlyQueryPlan): Promise<GenerationHourlyRow[]> {
    const conditions: SQL<unknown>[] = [
      eq(martGenerationHourly.fuelType, plan.fuelType),
      gte(martGenerationHourly.intervalStartAt, plan.fromUtc),
      lt(martGenerationHourly.intervalStartAt, plan.toExclusiveUtc),
    ];

    if (plan.region !== undefined) {
      conditions.push(eq(martGenerationHourly.regionCode, plan.region));
    }

    const cursorCondition = hourlyCursorCondition(plan.cursor);
    if (cursorCondition !== undefined) {
      conditions.push(cursorCondition);
    }

    // 공공데이터 집계 mart — organization_id scope 없음 (§10.3의 테넌트
    // 규칙은 고객 데이터 테이블에만 해당). datasource는 MVP에서 1개 seed —
    // 복수 소스가 생기면 소스 선택 의미론을 정한 뒤 필터를 추가한다.
    return this.db
      .select({
        intervalStartAt: martGenerationHourly.intervalStartAt,
        regionCode: martGenerationHourly.regionCode,
        fuelType: martGenerationHourly.fuelType,
        generationMwh: martGenerationHourly.generationMwh,
      })
      .from(martGenerationHourly)
      .where(and(...conditions))
      .orderBy(asc(martGenerationHourly.intervalStartAt), asc(martGenerationHourly.regionCode))
      .limit(plan.limit + 1);
  }

  private async selectDailyRows(plan: GenerationDailyQueryPlan): Promise<GenerationDailyRow[]> {
    const conditions: SQL<unknown>[] = [
      eq(martGenerationHourly.fuelType, plan.fuelType),
      gte(martGenerationHourly.sourceDate, plan.from),
      lte(martGenerationHourly.sourceDate, plan.to),
    ];

    if (plan.region !== undefined) {
      conditions.push(eq(martGenerationHourly.regionCode, plan.region));
    }

    const cursorCondition = dailyCursorCondition(plan.cursor);
    if (cursorCondition !== undefined) {
      conditions.push(cursorCondition);
    }

    return this.db
      .select({
        sourceDate: martGenerationHourly.sourceDate,
        regionCode: martGenerationHourly.regionCode,
        fuelType: martGenerationHourly.fuelType,
        generationMwh: sql<string | null>`sum(${martGenerationHourly.generationMwh})`,
      })
      .from(martGenerationHourly)
      .where(and(...conditions))
      .groupBy(
        martGenerationHourly.sourceDate,
        martGenerationHourly.regionCode,
        martGenerationHourly.fuelType,
      )
      .orderBy(asc(martGenerationHourly.sourceDate), asc(martGenerationHourly.regionCode))
      .limit(plan.limit + 1);
  }

  // 대량 결과라 row별 zod .parse() 금지(§10) — 직접 매핑만.
  private toHourlyItem(row: GenerationHourlyRow): GenerationHourlyItem {
    return {
      intervalStartAt: row.intervalStartAt.toISOString(),
      regionCode: row.regionCode,
      fuelType: row.fuelType as GenerationHourlyItem['fuelType'],
      generationMwh: Number(row.generationMwh),
    };
  }

  private toDailyItem(row: GenerationDailyRow): GenerationHourlyItem {
    return {
      intervalStartAt: isoDateToKstStartUtcDate(row.sourceDate, 'sourceDate').toISOString(),
      regionCode: row.regionCode,
      fuelType: row.fuelType as GenerationHourlyItem['fuelType'],
      generationMwh: Number(row.generationMwh ?? 0),
    };
  }

  private toMeta(plan: GenerationQueryPlan): GenerationHourlyResponse['meta'] {
    return {
      bucket: plan.bucket,
      from: plan.from,
      to: plan.to,
      timezone: KST_TIMEZONE,
      rangeDays: plan.rangeDays,
      limit: plan.limit,
      defaultedFrom: plan.defaultedFrom,
      defaultedTo: plan.defaultedTo,
      latestAvailableSourceDate: plan.latestAvailableSourceDate,
      maxRawRangeDays: GENERATION_RAW_MAX_RANGE_DAYS,
    };
  }
}

function hourlyCursorCondition(cursor: GenerationHourlyCursor | null): SQL<unknown> | undefined {
  if (cursor === null) {
    return undefined;
  }

  const intervalStartAt = new Date(cursor.intervalStartAt);

  return or(
    gt(martGenerationHourly.intervalStartAt, intervalStartAt),
    and(
      eq(martGenerationHourly.intervalStartAt, intervalStartAt),
      gt(martGenerationHourly.regionCode, cursor.regionCode),
    ),
  );
}

function dailyCursorCondition(cursor: GenerationDailyCursor | null): SQL<unknown> | undefined {
  if (cursor === null) {
    return undefined;
  }

  return or(
    gt(martGenerationHourly.sourceDate, cursor.sourceDate),
    and(
      eq(martGenerationHourly.sourceDate, cursor.sourceDate),
      gt(martGenerationHourly.regionCode, cursor.regionCode),
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
