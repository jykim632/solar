import { describe, expect, it } from 'vitest';
import type { KpxSupplyRow } from '@solar/ingestion-schemas';
import type { TransformContext } from '../core.js';
import {
  qualityCheckKpxSupply,
  transformKpxSupplyRows,
  type KpxSupplyMartRow,
} from './kpx-supply.js';

const context: TransformContext = {
  datasourceId: 3,
  ingestionRunId: 42n,
  ymd: '20260704',
  regionMap: new Map(),
  regionRows: [],
};

function row(overrides: Partial<KpxSupplyRow> = {}): KpxSupplyRow {
  return {
    baseDatetime: '20260704160000',
    suppAbility: 98592.5,
    currPwrTot: 64859.3008,
    forecastLoad: 0,
    suppReservePwr: 33733.1992,
    suppReserveRate: 52.0099,
    operReservePwr: 11538.2998,
    operReserveRate: 17.3347,
    rn: 1446947,
    ...overrides,
  };
}

describe('transformKpxSupplyRows', () => {
  it('maps KST baseDatetime to UTC observed_at and 5-minute slot_at', () => {
    const result = transformKpxSupplyRows([row({ baseDatetime: '20260704160000' })], context);
    const mart = result.rows[0]!;

    // 16:00 KST = 07:00 UTC. 이미 5분 경계라 observed_at === slot_at.
    expect((mart.observedAt as Date).toISOString()).toBe('2026-07-04T07:00:00.000Z');
    expect((mart.slotAt as Date).toISOString()).toBe('2026-07-04T07:00:00.000Z');
  });

  it('floors observed_at to the enclosing 5-minute slot for off-grid seconds', () => {
    const result = transformKpxSupplyRows([row({ baseDatetime: '20260704160237' })], context);
    const mart = result.rows[0]!;

    // 16:02:37 KST = 07:02:37 UTC, slot floors to 07:00.
    expect((mart.observedAt as Date).toISOString()).toBe('2026-07-04T07:02:37.000Z');
    expect((mart.slotAt as Date).toISOString()).toBe('2026-07-04T07:00:00.000Z');
  });

  it('maps supply/demand/reserve fields with fixed numeric precision', () => {
    const result = transformKpxSupplyRows([row()], context);
    const mart = result.rows[0]!;

    expect(mart.supplyAbilityMw).toBe('98592.50');
    expect(mart.currentDemandMw).toBe('64859.30');
    expect(mart.reservePowerMw).toBe('33733.20');
    expect(mart.reserveRatePct).toBe('52.01');
    expect(mart.operatingReservePowerMw).toBe('11538.30');
    expect(mart.operatingReserveRatePct).toBe('17.33');
    expect(mart.datasourceId).toBe(3);
    expect(mart.ingestionRunId).toBe(42n);
  });

  it('treats forecastLoad 0 as null (실측 구간엔 예보값이 없음)', () => {
    const result = transformKpxSupplyRows([row({ forecastLoad: 0 })], context);
    expect(result.rows[0]!.forecastLoadMw).toBeNull();
  });

  it('keeps a positive forecastLoad', () => {
    const result = transformKpxSupplyRows([row({ forecastLoad: 60800 })], context);
    expect(result.rows[0]!.forecastLoadMw).toBe('60800.00');
  });
});

describe('qualityCheckKpxSupply', () => {
  it('passes when slots are present and monotonically well-formed', () => {
    const martRows = transformKpxSupplyRows(
      [row({ baseDatetime: '20260704155500' }), row({ baseDatetime: '20260704160000' })],
      context,
    ).rows;

    const checks = qualityCheckKpxSupply({ ymd: '20260704', rawRows: [], martRows });
    expect(checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('fails when a run collected zero slots', () => {
    const checks = qualityCheckKpxSupply({ ymd: '20260704', rawRows: [], martRows: [] });
    const rowCount = checks.find((c) => c.checkName === 'kpx_supply.row_count')!;
    expect(rowCount.status).toBe('fail');
  });

  it('fails when a demand value is out of the plausible MW range', () => {
    const martRows: KpxSupplyMartRow[] = [
      {
        ...transformKpxSupplyRows([row()], context).rows[0]!,
        currentDemandMw: '-5',
      },
    ];
    const checks = qualityCheckKpxSupply({ ymd: '20260704', rawRows: [], martRows });
    const range = checks.find((c) => c.checkName === 'kpx_supply.range_mw')!;
    expect(range.status).toBe('fail');
  });
});
