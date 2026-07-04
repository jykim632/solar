import { sql } from 'drizzle-orm';
import type { Db } from '@solar/db';
import { martSmpHourly } from '@solar/db/schema';
import {
  DATA_GO_KR_OK,
  DataGoKrEnvelopeSchema,
  KpxSmpRowsSchema,
  type KpxSmpRow,
} from '@solar/ingestion-schemas';
import {
  addHours,
  kstDateHourToUtcDate,
  ymdToDateLiteral,
  type DataQualityCheckResult,
  type FetchIntervalContext,
  type FetchIntervalResult,
  type IngestionAdapter,
  type QualityCheckInput,
  type TransformContext,
  type TransformIssue,
  type TransformResult,
} from '../core.js';

/**
 * KPX 계통한계가격 및 수요예측(하루전 발전계획용) adapter (§9.5, solar-2af.6).
 *
 * dataset 15131225 — 구 계통한계가격조회(15076302, 삭제예정)의 §5.5 1순위 대체.
 * 엔드포인트 확정 2026-07-04(실호출 검증).
 *
 * 특성(실응답, data/samples/kpx-smp-latest.json):
 * - pageNo=1이 최신(하루전 예측이라 미래 날짜 포함), 마지막 페이지가 2020-01-01.
 *   수급현황과 정렬 방향이 반대 → 첫 페이지들만 긁어 최신 확보.
 * - hour 1..24 = KST [N-1시, N시). areaName '육지'/'제주'. smp 원/kWh.
 * - slfd/jlfd/mlfd(수요예측)는 SMP mart 대상 아님.
 */
const BASE_URL = 'https://apis.data.go.kr/B552115/SmpWithForecastDemand/getSmpWithForecastDemand';
const NUM_OF_ROWS = 100;
/** 최신 며칠치를 덮는 페이지 수. 하루=48행(24h×육지/제주), 여유롭게 최근 ~6일. */
const RECENT_PAGES = 3;

const MARKET_AREA_BY_NAME: Record<string, string> = {
  육지: 'LAND',
  제주: 'JEJU',
};

export type KpxSmpMartRow = typeof martSmpHourly.$inferInsert;

function buildSmpUrl(input: { apiKey: string; pageNo: number; numOfRows: number }): string {
  const params = new URLSearchParams({
    pageNo: String(input.pageNo),
    numOfRows: String(input.numOfRows),
    dataType: 'json',
  });

  // serviceKey는 포털이 준 encoded 값 그대로 붙인다 (재인코딩 금지).
  return `${BASE_URL}?serviceKey=${input.apiKey}&${params.toString()}`;
}

export async function fetchKpxSmpInterval(
  context: FetchIntervalContext,
): Promise<FetchIntervalResult> {
  const apiKey = context.apiKeys.dataGoKr;
  if (!apiKey) {
    throw new Error('DATA_GO_KR_API_KEY is required for kpx-smp.');
  }

  const rows: unknown[] = [];

  // page1이 최신이므로 앞에서부터 RECENT_PAGES개만 긁는다.
  for (let pageNo = 1; pageNo <= RECENT_PAGES; pageNo += 1) {
    const url = buildSmpUrl({ apiKey, pageNo, numOfRows: NUM_OF_ROWS });
    const response = await context.fetchImpl(url, {
      headers: { 'user-agent': 'solar-worker/0.1' },
    });
    const bodyText = await response.text();
    const contentType = response.headers.get('content-type') ?? undefined;

    await context.saveRaw({
      url,
      body: bodyText,
      httpStatus: response.status,
      contentType,
      fileExtension: 'json',
      metadata: { pageNo },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from kpx-smp.`);
    }

    let json: unknown;
    try {
      json = JSON.parse(bodyText);
    } catch {
      throw new Error('Response was saved but is not valid JSON.');
    }

    const envelopeResult = DataGoKrEnvelopeSchema.safeParse(json);
    if (!envelopeResult.success) {
      throw new Error(`DataGoKr envelope validation failed: ${envelopeResult.error.message}`);
    }

    const envelope = envelopeResult.data;
    if (envelope.response.header.resultCode !== DATA_GO_KR_OK) {
      throw new Error(
        `DataGoKr resultCode=${envelope.response.header.resultCode}: ${envelope.response.header.resultMsg}`,
      );
    }

    const body = envelope.response.body;
    const items = body?.items?.item ?? [];
    rows.push(...items);

    const totalCount = body?.totalCount ?? rows.length;
    if (items.length === 0 || rows.length >= totalCount) {
      break;
    }
  }

  return { rows };
}

export function transformKpxSmpRows(
  rawRows: unknown[],
  context: TransformContext,
): { rows: KpxSmpMartRow[]; issues: TransformIssue[] } {
  const rows = KpxSmpRowsSchema.parse(rawRows);
  const martRows: KpxSmpMartRow[] = [];
  const issues: TransformIssue[] = [];

  for (const row of rows) {
    const marketArea = MARKET_AREA_BY_NAME[row.areaName];

    if (!marketArea) {
      issues.push({
        code: 'unknown_market_area',
        severity: 'warn',
        message: `Unknown KPX SMP areaName "${row.areaName}".`,
        details: { date: row.date, hour: row.hour, areaName: row.areaName },
      });
      continue;
    }

    const sourceHour = row.hour - 1;
    const intervalStartAt = kstDateHourToUtcDate(row.date, sourceHour);

    martRows.push({
      intervalStartAt,
      intervalEndAt: addHours(intervalStartAt, 1),
      sourceDate: ymdToDateLiteral(row.date),
      sourceHour,
      marketArea,
      smpKrwPerKwh: row.smp.toFixed(2),
      datasourceId: context.datasourceId,
      ingestionRunId: context.ingestionRunId,
    });
  }

  return { rows: martRows, issues };
}

export function qualityCheckKpxSmp(input: {
  ymd: string;
  rawRows: KpxSmpRow[];
  martRows: KpxSmpMartRow[];
  issues: TransformIssue[];
}): DataQualityCheckResult[] {
  const coveredAreas = new Set(input.martRows.map((row) => row.marketArea));
  // §9.5 CHECK(0..1000)에 걸리기 전에 품질검사로 먼저 잡는다.
  const outOfRange = input.martRows.filter((row) => {
    const price = Number(row.smpKrwPerKwh);
    return !Number.isFinite(price) || price < 0 || price > 1000;
  }).length;
  const unknownAreaIssues = input.issues.filter((issue) => issue.code === 'unknown_market_area');

  return [
    {
      checkName: 'kpx_smp.row_count',
      status: input.martRows.length > 0 ? 'pass' : 'fail',
      details: { ymd: input.ymd, martRows: input.martRows.length },
    },
    {
      // 육지/제주 둘 다 있어야 정상. 하나만 오면 warn(부분 수집).
      checkName: 'kpx_smp.market_area_coverage',
      status: coveredAreas.has('LAND') && coveredAreas.has('JEJU') ? 'pass' : 'warn',
      details: { ymd: input.ymd, coveredAreas: [...coveredAreas].sort() },
    },
    {
      checkName: 'kpx_smp.range_price',
      status: outOfRange === 0 ? 'pass' : 'fail',
      details: { ymd: input.ymd, outOfRange },
    },
    {
      checkName: 'kpx_smp.unknown_area',
      status: unknownAreaIssues.length === 0 ? 'pass' : 'warn',
      details: {
        ymd: input.ymd,
        unknownCount: unknownAreaIssues.length,
        unknownAreaNames: [
          ...new Set(
            unknownAreaIssues.map((issue) =>
              typeof issue.details?.areaName === 'string' ? issue.details.areaName : 'UNKNOWN',
            ),
          ),
        ],
      },
    },
  ];
}

export async function upsertKpxSmpRows(db: Db, rows: KpxSmpMartRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await db
    .insert(martSmpHourly)
    .values(rows)
    .onConflictDoUpdate({
      target: [martSmpHourly.intervalStartAt, martSmpHourly.marketArea, martSmpHourly.datasourceId],
      set: {
        intervalEndAt: sql`excluded.interval_end_at`,
        sourceDate: sql`excluded.source_date`,
        sourceHour: sql`excluded.source_hour`,
        smpKrwPerKwh: sql`excluded.smp_krw_per_kwh`,
        ingestionRunId: sql`excluded.ingestion_run_id`,
      },
    });

  return rows.length;
}

export const kpxSmpAdapter: IngestionAdapter = {
  key: 'kpx-smp',
  datasourceName: 'kpx-smp',
  provider: 'KPX',
  requiredApiKeys: ['dataGoKr'],

  fetchInterval: fetchKpxSmpInterval,

  transformRows(rows, context): TransformResult {
    return transformKpxSmpRows(rows, context);
  },

  qualityChecks(input: QualityCheckInput) {
    return qualityCheckKpxSmp({
      ymd: input.ymd,
      rawRows: input.rawRows as KpxSmpRow[],
      martRows: input.martRows as KpxSmpMartRow[],
      issues: input.issues,
    });
  },

  upsertMart(db, rows) {
    return upsertKpxSmpRows(db, rows as KpxSmpMartRow[]);
  },
};
