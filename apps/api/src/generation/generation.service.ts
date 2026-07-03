import { Inject, Injectable } from '@nestjs/common';
import type {
  GenerationHourlyItem,
  GenerationHourlyQuery,
  GenerationHourlyResponse,
} from '@solar/api-contracts';
import type { Db } from '@solar/db';
import { martGenerationHourly } from '@solar/db/schema';
import { and, asc, eq, gt, gte, lt, lte, or, sql } from 'drizzle-orm';
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
    const latestSourceDate = await this.getLatestSourceDate();
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

  private async getLatestSourceDate(): Promise<string | null> {
    const [row] = await this.db
      .select({
        latestSourceDate: sql<string | null>`max(${martGenerationHourly.sourceDate})`,
      })
      .from(martGenerationHourly);

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
