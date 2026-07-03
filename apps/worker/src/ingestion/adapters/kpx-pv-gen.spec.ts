import { describe, expect, it } from 'vitest';
import type { KpxPvGenerationRow } from '@solar/ingestion-schemas';
import type { TransformContext } from '../core.js';
import { qualityCheckKpxPvGeneration, transformKpxPvGenerationRows } from './kpx-pv-gen.js';

const context: TransformContext = {
  datasourceId: 1,
  ingestionRunId: 10n,
  ymd: '20251231',
  regionMap: new Map([['서울시', 'SEOUL']]),
};

describe('transformKpxPvGenerationRows', () => {
  it('maps tradeNo 1..24 to [N-1h, Nh) KST intervals stored as UTC', () => {
    const rows: KpxPvGenerationRow[] = [
      { tradeNo: 1, tradeYmd: '20251231', regionNm: '서울시', amgo: 1.23456, rn: 1 },
      { tradeNo: 24, tradeYmd: '20251231', regionNm: '서울시', amgo: 2, rn: 2 },
    ];

    const result = transformKpxPvGenerationRows(rows, context);
    const first = result.rows[0]!;
    const last = result.rows[1]!;

    expect(first.sourceHour).toBe(0);
    expect((first.intervalStartAt as Date).toISOString()).toBe('2025-12-30T15:00:00.000Z');
    expect((first.intervalEndAt as Date).toISOString()).toBe('2025-12-30T16:00:00.000Z');
    expect(first.generationMwh).toBe('1.235');
    expect(first.sourceDate).toBe('2025-12-31');
    expect(first.fuelType).toBe('SOLAR');

    expect(last.sourceHour).toBe(23);
    expect((last.intervalStartAt as Date).toISOString()).toBe('2025-12-31T14:00:00.000Z');
    expect((last.intervalEndAt as Date).toISOString()).toBe('2025-12-31T15:00:00.000Z');
  });

  it('maps unknown KPX regionNm to UNKNOWN and emits a warn issue', () => {
    const rows: KpxPvGenerationRow[] = [
      { tradeNo: 1, tradeYmd: '20251231', regionNm: '미확인지역', amgo: 0, rn: 1 },
    ];

    const result = transformKpxPvGenerationRows(rows, context);

    expect(result.rows[0]!.regionCode).toBe('UNKNOWN');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe('unknown_region');
    expect(result.issues[0]!.severity).toBe('warn');
  });
});

describe('qualityCheckKpxPvGeneration', () => {
  it('warns (not fails) on incomplete row count — lag days are expected', () => {
    const checks = qualityCheckKpxPvGeneration({
      ymd: '20260601',
      rawRows: [],
      martRows: [],
      issues: [],
    });

    const rowCount = checks.find((c) => c.checkName === 'kpx_pv_gen.row_count')!;
    expect(rowCount.status).toBe('warn');
    expect(checks.every((c) => c.status !== 'fail')).toBe(true);
  });
});
