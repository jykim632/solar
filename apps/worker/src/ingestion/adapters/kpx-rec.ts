import { sql } from 'drizzle-orm';
import type { Db } from '@solar/db';
import { martRecMarketDaily } from '@solar/db/schema';
import { KpxRecMarketRowsSchema, type KpxRecMarketRow } from '@solar/ingestion-schemas';
import {
  ymdToDateLiteral,
  type DataGoKrAdapter,
  type DataQualityCheckResult,
  type QualityCheckInput,
  type TransformContext,
  type TransformResult,
} from '../core.js';

/**
 * KPX REC 현물시장 adapter. source 1행 → mart 3행(LAND/JEJU/TOTAL) fan-out
 * (§9.5 — close/total 통합값은 TOTAL 행에만). clsPrc는 육지 기준 종가로
 * 관측됨(2026-07-03) — TOTAL.close_price에 저장하되 §6.3 해석 확정 전까지
 * 화면에선 '육지 종가'로 표기 권장.
 */
const BASE_URL = 'https://apis.data.go.kr/B552115/RecMarketInfo2/getRecMarketInfo2';

export type KpxRecMarketMartRow = typeof martRecMarketDaily.$inferInsert;

export function transformKpxRecMarketRows(
  rows: KpxRecMarketRow[],
  context: TransformContext,
): { rows: KpxRecMarketMartRow[]; issues: [] } {
  const martRows: KpxRecMarketMartRow[] = [];

  for (const row of rows) {
    const tradeDate = ymdToDateLiteral(row.bzDd);

    martRows.push(
      {
        tradeDate,
        marketArea: 'LAND',
        tradeCount: row.landTrdCnt,
        volumeRec: row.landTrdRecValue.toFixed(3),
        avgPriceKrwPerRec: row.landAvgPrc.toFixed(2),
        highPriceKrwPerRec: row.landHgPrc.toFixed(2),
        lowPriceKrwPerRec: row.landLwPrc.toFixed(2),
        closePriceKrwPerRec: null,
        totalTradeAmountKrw: null,
        datasourceId: context.datasourceId,
        ingestionRunId: context.ingestionRunId,
      },
      {
        tradeDate,
        marketArea: 'JEJU',
        tradeCount: row.jejuTrdCnt,
        volumeRec: row.jejuTrdRecValue.toFixed(3),
        avgPriceKrwPerRec: row.jejuAvgPrc.toFixed(2),
        highPriceKrwPerRec: row.jejuHgPrc.toFixed(2),
        lowPriceKrwPerRec: row.jejuLwPrc.toFixed(2),
        closePriceKrwPerRec: null,
        totalTradeAmountKrw: null,
        datasourceId: context.datasourceId,
        ingestionRunId: context.ingestionRunId,
      },
      {
        tradeDate,
        marketArea: 'TOTAL',
        tradeCount: row.totCnt,
        volumeRec: row.totRecValue.toFixed(3),
        avgPriceKrwPerRec: null,
        highPriceKrwPerRec: null,
        lowPriceKrwPerRec: null,
        closePriceKrwPerRec: row.clsPrc.toFixed(2),
        totalTradeAmountKrw: row.bidTrdVal.toFixed(2),
        datasourceId: context.datasourceId,
        ingestionRunId: context.ingestionRunId,
      },
    );
  }

  return { rows: martRows, issues: [] };
}

export function qualityCheckKpxRecMarket(input: {
  ymd: string;
  rawRows: KpxRecMarketRow[];
  martRows: KpxRecMarketMartRow[];
}): DataQualityCheckResult[] {
  const outOfRangeRows = input.martRows.filter((row) => {
    const values = [
      row.tradeCount,
      row.volumeRec,
      row.avgPriceKrwPerRec,
      row.highPriceKrwPerRec,
      row.lowPriceKrwPerRec,
      row.closePriceKrwPerRec,
      row.totalTradeAmountKrw,
    ].filter((value) => value != null);

    return values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0);
  }).length;

  return [
    {
      // 비개장일(월수금·공휴일)은 0건이 정상 — warn까지만.
      checkName: 'kpx_rec.row_count',
      status: input.rawRows.length > 0 ? 'pass' : 'warn',
      details: {
        ymd: input.ymd,
        rawRows: input.rawRows.length,
        note: input.rawRows.length === 0 ? 'No REC trading row for this date.' : undefined,
      },
    },
    {
      checkName: 'kpx_rec.fan_out',
      status: input.martRows.length === input.rawRows.length * 3 ? 'pass' : 'fail',
      details: {
        ymd: input.ymd,
        rawRows: input.rawRows.length,
        martRows: input.martRows.length,
        expectedMartRows: input.rawRows.length * 3,
      },
    },
    {
      checkName: 'kpx_rec.range_non_negative',
      status: outOfRangeRows === 0 ? 'pass' : 'fail',
      details: { ymd: input.ymd, outOfRangeRows },
    },
  ];
}

export async function upsertKpxRecMarketRows(
  db: Db,
  rows: KpxRecMarketMartRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await db
    .insert(martRecMarketDaily)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        martRecMarketDaily.tradeDate,
        martRecMarketDaily.marketArea,
        martRecMarketDaily.datasourceId,
      ],
      set: {
        tradeCount: sql`excluded.trade_count`,
        volumeRec: sql`excluded.volume_rec`,
        avgPriceKrwPerRec: sql`excluded.avg_price_krw_per_rec`,
        highPriceKrwPerRec: sql`excluded.high_price_krw_per_rec`,
        lowPriceKrwPerRec: sql`excluded.low_price_krw_per_rec`,
        closePriceKrwPerRec: sql`excluded.close_price_krw_per_rec`,
        totalTradeAmountKrw: sql`excluded.total_trade_amount_krw`,
        ingestionRunId: sql`excluded.ingestion_run_id`,
      },
    });

  return rows.length;
}

export const kpxRecMarketAdapter: DataGoKrAdapter = {
  key: 'kpx-rec',
  datasourceName: 'kpx-rec',
  provider: 'KPX',
  defaultNumOfRows: 500,

  buildUrl(input) {
    const params = new URLSearchParams({
      pageNo: String(input.pageNo),
      numOfRows: String(input.numOfRows),
      dataType: 'json',
      bzDd: input.ymd,
    });

    return `${BASE_URL}?serviceKey=${input.apiKey}&${params.toString()}`;
  },

  parseRows(items) {
    return KpxRecMarketRowsSchema.parse(items);
  },

  transformRows(rows, context): TransformResult {
    return transformKpxRecMarketRows(rows as KpxRecMarketRow[], context);
  },

  qualityChecks(input: QualityCheckInput) {
    return qualityCheckKpxRecMarket({
      ymd: input.ymd,
      rawRows: input.rawRows as KpxRecMarketRow[],
      martRows: input.martRows as KpxRecMarketMartRow[],
    });
  },

  upsertMart(db, rows) {
    return upsertKpxRecMarketRows(db, rows as KpxRecMarketMartRow[]);
  },
};
