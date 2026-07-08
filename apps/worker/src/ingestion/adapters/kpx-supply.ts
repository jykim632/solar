import { sql } from 'drizzle-orm';
import type { Db } from '@solar/db';
import { martSupplyRealtime } from '@solar/db/schema';
import {
  DATA_GO_KR_OK,
  DataGoKrEnvelopeSchema,
  KpxSupplyRowsSchema,
  type KpxSupplyRow,
} from '@solar/ingestion-schemas';
import {
  kstYmdHmsToUtcDate,
  floorToSlot,
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
 * KPX 현재전력수급현황 5분 슬롯 adapter (§9.6, solar-2af.4).
 *
 * 신규 대체 API(_GW, 15158704) — 구 openapi.kpx.or.kr 게이트웨이(resultCode 20)
 * 대신 data.go.kr B552115 계열로 이관됨(2026-07-04 KPX 공식 안내).
 *
 * 특성(실응답 확정, data/samples/kpx-supply-latest.json):
 * - 이름은 "Today"지만 날짜 필터(baseDatetime/searchDate)가 무시되고 2012-06-01
 *   부터 rn 오름차순 전체이력(totalCount 144만+)을 반환. 최신은 마지막 페이지.
 *   → 5분/15분 스케줄 실행은 마지막 페이지 N개만 긁어 최신 슬롯만 upsert한다.
 * - baseDatetime: KST YYYYMMDDHHMMSS(5분 정렬). forecastLoad는 실측 구간 0.0.
 */
const BASE_URL = 'https://apis.data.go.kr/B552115/Sukub5mToday/getSukub5mToday';
const NUM_OF_ROWS = 100;
/** 스케줄 주기(≤15분)의 여유분 — 최근 ~2.5시간(30슬롯)치를 재확인해 지연 도착/보정을 흡수. */
const RECENT_SLOTS = 30;

export type KpxSupplyMartRow = typeof martSupplyRealtime.$inferInsert;

function buildSupplyUrl(input: { apiKey: string; pageNo: number; numOfRows: number }): string {
  const params = new URLSearchParams({
    pageNo: String(input.pageNo),
    numOfRows: String(input.numOfRows),
    dataType: 'json',
  });

  // serviceKey는 포털이 준 encoded 값 그대로 붙인다 (재인코딩 금지).
  return `${BASE_URL}?serviceKey=${input.apiKey}&${params.toString()}`;
}

async function fetchSupplyPage(
  context: FetchIntervalContext,
  apiKey: string,
  pageNo: number,
): Promise<{ items: unknown[]; totalCount: number }> {
  const url = buildSupplyUrl({ apiKey, pageNo, numOfRows: NUM_OF_ROWS });
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
    throw new Error(`HTTP ${response.status} from kpx-supply.`);
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
  return {
    items: body?.items?.item ?? [],
    totalCount: body?.totalCount ?? 0,
  };
}

export async function fetchKpxSupplyInterval(
  context: FetchIntervalContext,
): Promise<FetchIntervalResult> {
  const apiKey = context.apiKeys.dataGoKr;
  if (!apiKey) {
    throw new Error('DATA_GO_KR_API_KEY is required for kpx-supply.');
  }

  // 1) totalCount만 알아내는 가벼운 probe(마지막 페이지 계산용).
  const probe = await fetchSupplyPage(context, apiKey, 1);
  if (probe.totalCount === 0) {
    return { rows: [] };
  }

  // 2) 최신 RECENT_SLOTS개를 포함하는 마지막 페이지들만 역순으로 긁는다.
  const lastPage = Math.ceil(probe.totalCount / NUM_OF_ROWS);
  const pagesToPull = Math.max(1, Math.ceil(RECENT_SLOTS / NUM_OF_ROWS));
  const firstPage = Math.max(1, lastPage - pagesToPull + 1);

  const rows: unknown[] = [];
  for (let pageNo = firstPage; pageNo <= lastPage; pageNo += 1) {
    const page = await fetchSupplyPage(context, apiKey, pageNo);
    rows.push(...page.items);
  }

  return { rows };
}

export function transformKpxSupplyRows(
  rawRows: unknown[],
  context: TransformContext,
): { rows: KpxSupplyMartRow[]; issues: TransformIssue[] } {
  const rows = KpxSupplyRowsSchema.parse(rawRows);
  const martRows: KpxSupplyMartRow[] = [];
  const issues: TransformIssue[] = [];

  for (const row of rows) {
    const observedAt = kstYmdHmsToUtcDate(row.baseDatetime);

    martRows.push({
      observedAt,
      slotAt: floorToSlot(observedAt, 5),
      supplyAbilityMw: mw(row.suppAbility),
      currentDemandMw: mw(row.currPwrTot),
      // 실측 구간의 forecastLoad는 0.0(예보값 아님) — null 처리(§9.6).
      forecastLoadMw: row.forecastLoad > 0 ? mw(row.forecastLoad) : null,
      reservePowerMw: mw(row.suppReservePwr),
      reserveRatePct: pct(row.suppReserveRate),
      operatingReservePowerMw: mw(row.operReservePwr),
      operatingReserveRatePct: pct(row.operReserveRate),
      datasourceId: context.datasourceId,
      ingestionRunId: context.ingestionRunId,
    });
  }

  return { rows: martRows, issues };
}

export function qualityCheckKpxSupply(input: {
  ymd: string;
  rawRows: KpxSupplyRow[];
  martRows: KpxSupplyMartRow[];
}): DataQualityCheckResult[] {
  const outOfRange = input.martRows.filter((row) => {
    const demand = Number(row.currentDemandMw);
    const supply = Number(row.supplyAbilityMw);
    return (
      !Number.isFinite(demand) ||
      demand < 0 ||
      demand > 200000 ||
      !Number.isFinite(supply) ||
      supply < 0 ||
      supply > 200000
    );
  }).length;

  return [
    {
      // 실시간 API라 매 실행 최소 1슬롯은 있어야 한다 — 0건은 수집 실패.
      checkName: 'kpx_supply.row_count',
      status: input.martRows.length > 0 ? 'pass' : 'fail',
      details: { ymd: input.ymd, martRows: input.martRows.length },
    },
    {
      checkName: 'kpx_supply.range_mw',
      status: outOfRange === 0 ? 'pass' : 'fail',
      details: { ymd: input.ymd, outOfRange },
    },
  ];
}

export async function upsertKpxSupplyRows(db: Db, rows: KpxSupplyMartRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await db
    .insert(martSupplyRealtime)
    .values(rows)
    .onConflictDoUpdate({
      target: [martSupplyRealtime.slotAt, martSupplyRealtime.datasourceId],
      set: {
        observedAt: sql`excluded.observed_at`,
        supplyAbilityMw: sql`excluded.supply_ability_mw`,
        currentDemandMw: sql`excluded.current_demand_mw`,
        forecastLoadMw: sql`excluded.forecast_load_mw`,
        reservePowerMw: sql`excluded.reserve_power_mw`,
        reserveRatePct: sql`excluded.reserve_rate_pct`,
        operatingReservePowerMw: sql`excluded.operating_reserve_power_mw`,
        operatingReserveRatePct: sql`excluded.operating_reserve_rate_pct`,
        ingestionRunId: sql`excluded.ingestion_run_id`,
      },
    });

  return rows.length;
}

export const kpxSupplyAdapter: IngestionAdapter = {
  key: 'kpx-supply',
  datasourceName: 'kpx-supply',
  provider: 'KPX',
  requiredApiKeys: ['dataGoKr'],

  fetchInterval: fetchKpxSupplyInterval,

  transformRows(rows, context): TransformResult {
    return transformKpxSupplyRows(rows, context);
  },

  qualityChecks(input: QualityCheckInput) {
    return qualityCheckKpxSupply({
      ymd: input.ymd,
      rawRows: input.rawRows as KpxSupplyRow[],
      martRows: input.martRows as KpxSupplyMartRow[],
    });
  },

  upsertMart(db, rows) {
    return upsertKpxSupplyRows(db, rows as KpxSupplyMartRow[]);
  },
};

/** MW/MWh 계량값: NUMERIC(10,2). */
function mw(value: number): string {
  return value.toFixed(2);
}

/** 백분율: NUMERIC(5,2). */
function pct(value: number): string {
  return value.toFixed(2);
}
