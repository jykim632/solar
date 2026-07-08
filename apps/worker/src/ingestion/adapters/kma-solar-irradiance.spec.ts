import { describe, expect, it } from 'vitest';
import type { TransformContext } from '../core.js';
import {
  buildIrradianceChunks,
  parseIrradianceText,
  transformKmaSolarIrradianceRows,
} from './kma-solar-irradiance.js';

// data/samples/solar-irradiance-point-2026-07-03.txt의 실응답 그대로.
const realSampleText = `=============================================================================================
|      TMFC      |    VAR   |     LON    |    LAT    |  202607020000  |  202607020030  |  202607020100  |  202607020130  |  202607020200  |  202607020230  |  202607020300  |  202607020330  |  202607020400  |  202607020430  |  202607020500  |  202607020530  |  202607020600  |  202607020630  |  202607020700  |  202607020730  |  202607020800  |  202607020830  |  202607020900  |  202607020930  |  202607021000  |  202607021030  |  202607021100  |
=============================================================================================
|  202607020000  |  AI-DSR  |  126.9780  |  37.5665  |           0.8  |           1.1  |           1.3  |           1.0  |           0.9  |           1.0  |           0.9  |           1.1  |           1.2  |           1.3  |           1.4  |           0.9  |           1.0  |           1.4  |           1.1  |           0.7  |           0.4  |           0.4  |           0.5  |           0.3  |           0.2  |           0.4  |           0.1  |
=============================================================================================
`;

const context: TransformContext = {
  datasourceId: 4,
  ingestionRunId: 40n,
  ymd: '20260702',
  regionMap: new Map(),
  regionRows: [],
};

describe('buildIrradianceChunks', () => {
  it('returns exactly two 24-slot UTC chunks', () => {
    const chunks = buildIrradianceChunks('20260702');

    expect(chunks).toEqual([
      { tm1: '202607020000', tm2: '202607021130' },
      { tm1: '202607021200', tm2: '202607022330' },
    ]);
    expect(chunks.map(countThirtyMinuteSlots)).toEqual([24, 24]);
  });
});

describe('parseIrradianceText', () => {
  it('parses real KMA irradiance sample lines', () => {
    const parsed = parseIrradianceText(realSampleText);

    expect(parsed.slots).toHaveLength(23);
    expect(parsed.slots[0]).toBe('202607020000');
    expect(parsed.slots[22]).toBe('202607021100');
    expect(parsed.values[0]).toBe(0.8);
    expect(parsed.values[1]).toBe(1.1);
    expect(parsed.values[22]).toBe(0.1);
  });

  it('maps sentinel values to null', () => {
    const parsed = parseIrradianceText(
      [
        '==============================================================',
        '| TMFC | VAR | LON | LAT | 202607020000 | 202607020030 | 202607020100 | 202607020130 |',
        '==============================================================',
        '| 202607020000 | AI-DSR | 126.9780 | 37.5665 | -9 | -99 | -999 | |',
        '==============================================================',
      ].join('\n'),
    );

    expect(parsed.slots).toEqual([
      '202607020000',
      '202607020030',
      '202607020100',
      '202607020130',
    ]);
    expect(parsed.values).toEqual([null, null, null, null]);
  });

  it('throws on KMA APIHub error text', () => {
    expect(() => parseIrradianceText('<Error>invalid auth key</Error>')).toThrow(
      'KMA APIHub error response',
    );
  });
});

describe('transformKmaSolarIrradianceRows', () => {
  it('stores observedAtKst as observedAtUtc plus 9 hours', () => {
    const result = transformKmaSolarIrradianceRows(
      [
        {
          regionCode: 'SEOUL',
          observedAtUtc: new Date('2026-07-02T15:00:00.000Z'),
          value: 1.2,
        },
      ],
      context,
    );

    expect(result.issues).toHaveLength(0);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0]!;
    expect((row.observedAtUtc as Date).toISOString()).toBe('2026-07-02T15:00:00.000Z');
    expect((row.observedAtKst as Date).toISOString()).toBe('2026-07-03T00:00:00.000Z');
    expect(row.irradianceValue).toBe('1.200');
    expect(row.irradianceUnit).toBe('MJ/m2');
  });

  it('nulls negative values with a warn issue', () => {
    const result = transformKmaSolarIrradianceRows(
      [
        {
          regionCode: 'SEOUL',
          observedAtUtc: new Date('2026-07-02T15:00:00.000Z'),
          value: -1,
        },
      ],
      context,
    );

    expect(result.rows[0]!.irradianceValue).toBeNull();
    expect(result.issues[0]!.code).toBe('negative_irradiance_value');
  });
});

function countThirtyMinuteSlots(chunk: { tm1: string; tm2: string }): number {
  const start = stampToUtcMs(chunk.tm1);
  const end = stampToUtcMs(chunk.tm2);

  return (end - start) / (30 * 60 * 1000) + 1;
}

function stampToUtcMs(stamp: string): number {
  return Date.UTC(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
    Number(stamp.slice(8, 10)),
    Number(stamp.slice(10, 12)),
  );
}
