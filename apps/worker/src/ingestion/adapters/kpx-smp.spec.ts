import { describe, expect, it } from 'vitest';
import type { KpxSmpRow } from '@solar/ingestion-schemas';
import type { TransformContext } from '../core.js';
import {
  qualityCheckKpxSmp,
  transformKpxSmpRows,
  type KpxSmpMartRow,
} from './kpx-smp.js';

const context: TransformContext = {
  datasourceId: 6,
  ingestionRunId: 77n,
  ymd: '20260706',
  regionMap: new Map(),
  regionRows: [],
};

function row(overrides: Partial<KpxSmpRow> = {}): KpxSmpRow {
  return { date: '20260706', hour: 1, areaName: '육지', smp: 93.83, rn: 1, ...overrides };
}

describe('transformKpxSmpRows', () => {
  it('maps hour 1..24 to [N-1h, Nh) KST intervals stored as UTC', () => {
    const result = transformKpxSmpRows(
      [row({ hour: 1 }), row({ hour: 24 })],
      context,
    );
    const first = result.rows[0]!;
    const last = result.rows[1]!;

    // hour 1 = 00:00~01:00 KST = 2026-07-05T15:00Z start.
    expect(first.sourceHour).toBe(0);
    expect((first.intervalStartAt as Date).toISOString()).toBe('2026-07-05T15:00:00.000Z');
    expect((first.intervalEndAt as Date).toISOString()).toBe('2026-07-05T16:00:00.000Z');
    expect(first.sourceDate).toBe('2026-07-06');

    // hour 24 = 23:00~24:00 KST = 2026-07-06T14:00Z start.
    expect(last.sourceHour).toBe(23);
    expect((last.intervalStartAt as Date).toISOString()).toBe('2026-07-06T14:00:00.000Z');
    expect((last.intervalEndAt as Date).toISOString()).toBe('2026-07-06T15:00:00.000Z');
  });

  it('maps areaName 육지/제주 to market_area LAND/JEJU', () => {
    const result = transformKpxSmpRows(
      [row({ areaName: '육지' }), row({ areaName: '제주' })],
      context,
    );

    expect(result.rows[0]!.marketArea).toBe('LAND');
    expect(result.rows[1]!.marketArea).toBe('JEJU');
    expect(result.issues).toHaveLength(0);
  });

  it('stores smp as 원/kWh with 2-decimal precision', () => {
    const result = transformKpxSmpRows([row({ smp: 93.83 })], context);
    const mart = result.rows[0]!;
    expect(mart.smpKrwPerKwh).toBe('93.83');
    expect(mart.datasourceId).toBe(6);
    expect(mart.ingestionRunId).toBe(77n);
  });

  it('skips an unknown areaName and emits a warn issue', () => {
    const result = transformKpxSmpRows([row({ areaName: '경기' })], context);
    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe('unknown_market_area');
    expect(result.issues[0]!.severity).toBe('warn');
  });
});

describe('qualityCheckKpxSmp', () => {
  it('passes when both market areas are covered with plausible prices', () => {
    const martRows = transformKpxSmpRows(
      [row({ areaName: '육지' }), row({ areaName: '제주' })],
      context,
    ).rows;
    const checks = qualityCheckKpxSmp({ ymd: '20260706', rawRows: [], martRows, issues: [] });
    expect(checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('fails when an smp value is implausibly out of range', () => {
    const martRows: KpxSmpMartRow[] = [
      { ...transformKpxSmpRows([row()], context).rows[0]!, smpKrwPerKwh: '5000' },
    ];
    const checks = qualityCheckKpxSmp({ ymd: '20260706', rawRows: [], martRows, issues: [] });
    const range = checks.find((c) => c.checkName === 'kpx_smp.range_price')!;
    expect(range.status).toBe('fail');
  });

  it('fails when no rows were produced', () => {
    const checks = qualityCheckKpxSmp({ ymd: '20260706', rawRows: [], martRows: [], issues: [] });
    const rowCount = checks.find((c) => c.checkName === 'kpx_smp.row_count')!;
    expect(rowCount.status).toBe('fail');
  });
});
