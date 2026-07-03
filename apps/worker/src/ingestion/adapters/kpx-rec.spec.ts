import { describe, expect, it } from 'vitest';
import type { KpxRecMarketRow } from '@solar/ingestion-schemas';
import type { TransformContext } from '../core.js';
import { qualityCheckKpxRecMarket, transformKpxRecMarketRows } from './kpx-rec.js';

const context: TransformContext = {
  datasourceId: 2,
  ingestionRunId: 20n,
  ymd: '20260702',
  regionMap: new Map(),
};

// data/samples/rec-latest-2026-07-03.json의 실측값 기반.
const source: KpxRecMarketRow = {
  bzDd: '20260702',
  clsPrc: 71500,
  landAvgPrc: 71658,
  landHgPrc: 71800,
  landLwPrc: 71500,
  landUplmtPrc: 78800,
  landLwlmtPrc: 64600,
  landOrdCnt: 9409,
  landOrdRecValue: 425682,
  landTrdCnt: 7727,
  landTrdRecValue: 290383,
  jejuAvgPrc: 86185,
  jejuHgPrc: 113700,
  jejuLwPrc: 59500,
  jejuUplmtPrc: 78800,
  jejuLwlmtPrc: 64600,
  jejuOrdCnt: 104,
  jejuOrdRecValue: 8425,
  jejuTrdCnt: 93,
  jejuTrdRecValue: 6546,
  totCnt: 7820,
  totRecValue: 296929,
  trdCnt: 74,
  trdRecValue: 583399,
  bidTrdVal: 21372535800,
  rn: 904,
};

describe('transformKpxRecMarketRows', () => {
  it('fans one REC source row out to LAND, JEJU, TOTAL mart rows', () => {
    const result = transformKpxRecMarketRows([source], context);
    expect(result.rows).toHaveLength(3);

    const [land, jeju, total] = result.rows as [
      (typeof result.rows)[0],
      (typeof result.rows)[1],
      (typeof result.rows)[2],
    ];

    expect(land.marketArea).toBe('LAND');
    expect(land.tradeDate).toBe('2026-07-02');
    expect(land.tradeCount).toBe(7727);
    expect(land.volumeRec).toBe('290383.000');
    expect(land.avgPriceKrwPerRec).toBe('71658.00');
    expect(land.closePriceKrwPerRec).toBeNull();

    expect(jeju.marketArea).toBe('JEJU');
    expect(jeju.avgPriceKrwPerRec).toBe('86185.00');
    expect(jeju.tradeCount).toBe(93);

    expect(total.marketArea).toBe('TOTAL');
    expect(total.tradeCount).toBe(7820);
    expect(total.volumeRec).toBe('296929.000');
    expect(total.closePriceKrwPerRec).toBe('71500.00');
    expect(total.totalTradeAmountKrw).toBe('21372535800.00');
    expect(total.avgPriceKrwPerRec).toBeNull();
  });
});

describe('qualityCheckKpxRecMarket', () => {
  it('warns (not fails) on empty non-trading days', () => {
    const checks = qualityCheckKpxRecMarket({ ymd: '20260701', rawRows: [], martRows: [] });

    const rowCount = checks.find((c) => c.checkName === 'kpx_rec.row_count')!;
    expect(rowCount.status).toBe('warn');
    expect(checks.every((c) => c.status !== 'fail')).toBe(true);
  });

  it('fails when fan-out count mismatches', () => {
    const result = transformKpxRecMarketRows([source], context);
    const checks = qualityCheckKpxRecMarket({
      ymd: '20260702',
      rawRows: [source],
      martRows: result.rows.slice(0, 2),
    });

    expect(checks.find((c) => c.checkName === 'kpx_rec.fan_out')!.status).toBe('fail');
  });
});
