import { sql } from 'drizzle-orm';
import type { Db } from '@solar/db';
import { martGenerationHourly } from '@solar/db/schema';
import { KpxPvGenerationRowsSchema, type KpxPvGenerationRow } from '@solar/ingestion-schemas';
import {
  UNKNOWN_REGION_CODE,
  addHours,
  kstDateHourToUtcDate,
  ymdToDateLiteral,
  type DataGoKrAdapter,
  type DataQualityCheckResult,
  type QualityCheckInput,
  type TransformContext,
  type TransformIssue,
  type TransformResult,
} from '../core.js';

/**
 * KPX 지역별 시간별 태양광 발전량 adapter.
 * 실응답 확정 사실(data/samples/): tradeNo 1..24 = KST [N-1시, N시),
 * regionNm 17종(합계 row 없음), amgo MWh, 데이터 lag ~2개월.
 */
const BASE_URL = 'https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr';
const EXPECTED_ROWS_PER_DAY = 17 * 24;

export type KpxPvGenerationMartRow = typeof martGenerationHourly.$inferInsert;

export function transformKpxPvGenerationRows(
  rows: KpxPvGenerationRow[],
  context: TransformContext,
): { rows: KpxPvGenerationMartRow[]; issues: TransformIssue[] } {
  const martRows: KpxPvGenerationMartRow[] = [];
  const issues: TransformIssue[] = [];

  for (const row of rows) {
    const sourceHour = row.tradeNo - 1;
    const intervalStartAt = kstDateHourToUtcDate(row.tradeYmd, sourceHour);
    const regionCode = context.regionMap.get(row.regionNm) ?? UNKNOWN_REGION_CODE;

    if (regionCode === UNKNOWN_REGION_CODE) {
      issues.push({
        code: 'unknown_region',
        severity: 'warn',
        message: `Unknown KPX regionNm "${row.regionNm}".`,
        details: {
          ymd: row.tradeYmd,
          tradeNo: row.tradeNo,
          regionNm: row.regionNm,
        },
      });
    }

    martRows.push({
      intervalStartAt,
      intervalEndAt: addHours(intervalStartAt, 1),
      sourceDate: ymdToDateLiteral(row.tradeYmd),
      sourceHour,
      regionCode,
      fuelType: 'SOLAR',
      generationMwh: row.amgo.toFixed(3),
      includesEss: null,
      datasourceId: context.datasourceId,
      ingestionRunId: context.ingestionRunId,
    });
  }

  return { rows: martRows, issues };
}

export function qualityCheckKpxPvGeneration(input: {
  ymd: string;
  rawRows: KpxPvGenerationRow[];
  martRows: KpxPvGenerationMartRow[];
  issues: TransformIssue[];
}): DataQualityCheckResult[] {
  const unknownRegionIssues = input.issues.filter((issue) => issue.code === 'unknown_region');

  const outOfRangeRows = input.martRows.filter(
    (row) =>
      row.sourceHour == null ||
      row.sourceHour < 0 ||
      row.sourceHour > 23 ||
      !Number.isFinite(Number(row.generationMwh)) ||
      Number(row.generationMwh) < 0,
  ).length;

  return [
    {
      // lag 기간엔 0건이 정상이라 row_count는 warn까지만 — fail로 두면
      // 매일 스케줄 실행이 전부 partial로 기록된다.
      checkName: 'kpx_pv_gen.row_count',
      status: input.rawRows.length === EXPECTED_ROWS_PER_DAY ? 'pass' : 'warn',
      details: {
        ymd: input.ymd,
        expectedRows: EXPECTED_ROWS_PER_DAY,
        rawRows: input.rawRows.length,
        martRows: input.martRows.length,
      },
    },
    {
      checkName: 'kpx_pv_gen.range_generation_mwh',
      status: outOfRangeRows === 0 ? 'pass' : 'fail',
      details: { ymd: input.ymd, outOfRangeRows },
    },
    {
      checkName: 'kpx_pv_gen.region_mapping',
      status: unknownRegionIssues.length === 0 ? 'pass' : 'warn',
      details: {
        ymd: input.ymd,
        unknownCount: unknownRegionIssues.length,
        unknownRegionNames: [
          ...new Set(
            unknownRegionIssues.map((issue) =>
              typeof issue.details?.regionNm === 'string' ? issue.details.regionNm : 'UNKNOWN',
            ),
          ),
        ],
      },
    },
  ];
}

export async function upsertKpxPvGenerationRows(
  db: Db,
  rows: KpxPvGenerationMartRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await db
    .insert(martGenerationHourly)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        martGenerationHourly.intervalStartAt,
        martGenerationHourly.regionCode,
        martGenerationHourly.fuelType,
        martGenerationHourly.datasourceId,
      ],
      set: {
        intervalEndAt: sql`excluded.interval_end_at`,
        sourceDate: sql`excluded.source_date`,
        sourceHour: sql`excluded.source_hour`,
        generationMwh: sql`excluded.generation_mwh`,
        includesEss: sql`excluded.includes_ess`,
        ingestionRunId: sql`excluded.ingestion_run_id`,
      },
    });

  return rows.length;
}

export const kpxPvGenerationAdapter: DataGoKrAdapter = {
  key: 'kpx-pv-gen',
  datasourceName: 'kpx-pv-gen',
  provider: 'KPX',
  defaultNumOfRows: 500,

  buildUrl(input) {
    const params = new URLSearchParams({
      pageNo: String(input.pageNo),
      numOfRows: String(input.numOfRows),
      dataType: 'json',
      tradeYmd: input.ymd,
    });

    // serviceKey는 포털이 준 encoded 값 그대로 붙인다 (재인코딩 금지).
    return `${BASE_URL}?serviceKey=${input.apiKey}&${params.toString()}`;
  },

  parseRows(items) {
    return KpxPvGenerationRowsSchema.parse(items);
  },

  transformRows(rows, context): TransformResult {
    return transformKpxPvGenerationRows(rows as KpxPvGenerationRow[], context);
  },

  qualityChecks(input: QualityCheckInput) {
    return qualityCheckKpxPvGeneration({
      ymd: input.ymd,
      rawRows: input.rawRows as KpxPvGenerationRow[],
      martRows: input.martRows as KpxPvGenerationMartRow[],
      issues: input.issues,
    });
  },

  upsertMart(db, rows) {
    return upsertKpxPvGenerationRows(db, rows as KpxPvGenerationMartRow[]);
  },
};
