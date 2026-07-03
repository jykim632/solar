import { describe, expect, it } from 'vitest';
import type { KmaVilageFcstRow } from '@solar/ingestion-schemas';
import type { IngestionRegionRow, TransformContext } from '../core.js';
import { parsePcpValue, transformKmaVilageFcstRows } from './kma-vilage-fcst.js';

const regionRows = [
  {
    regionCode: 'SEOUL',
    regionName: '서울특별시',
    kpxRegionName: '서울시',
    kmaGridX: 60,
    kmaGridY: 127,
    lat: '37.566535',
    lon: '126.977969',
  },
] satisfies IngestionRegionRow[];

const context: TransformContext = {
  datasourceId: 3,
  ingestionRunId: 30n,
  ymd: '20260703',
  regionMap: new Map(),
  regionRows,
};

function fcstRow(category: KmaVilageFcstRow['category'], fcstValue: string): KmaVilageFcstRow {
  return {
    baseDate: '20260703',
    baseTime: '0500',
    category,
    fcstDate: '20260703',
    fcstTime: '0600',
    fcstValue,
    nx: 60,
    ny: 127,
  };
}

describe('parsePcpValue', () => {
  it('parses KMA precipitation bucket strings', () => {
    expect(parsePcpValue('강수없음')).toBe(0);
    expect(parsePcpValue('1.0mm 미만')).toBe(0.5);
    expect(parsePcpValue('1.0mm')).toBe(1);
    expect(parsePcpValue('30.0~50.0mm')).toBe(30);
    expect(parsePcpValue('50.0mm 이상')).toBe(50);
    expect(parsePcpValue('알수없음')).toBeNull();
  });
});

describe('transformKmaVilageFcstRows', () => {
  it('pivots realistic KMA category rows and excludes TMN/TMX rows', () => {
    // data/samples/fcst-vilage-2026-07-03.json의 실측 카테고리 구성.
    const rows: KmaVilageFcstRow[] = [
      fcstRow('TMP', '22'),
      fcstRow('UUU', '0'),
      fcstRow('VVV', '1'),
      fcstRow('VEC', '180'),
      fcstRow('WSD', '1'),
      fcstRow('SKY', '4'),
      fcstRow('PTY', '0'),
      fcstRow('POP', '30'),
      fcstRow('WAV', '0'),
      fcstRow('PCP', '강수없음'),
      fcstRow('REH', '90'),
      fcstRow('SNO', '적설없음'),
      fcstRow('TMN', '18'),
      fcstRow('TMX', '31'),
    ];

    const result = transformKmaVilageFcstRows(rows, context);
    expect(result.issues).toHaveLength(0);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0]!;
    expect(row.regionCode).toBe('SEOUL');
    expect((row.baseAt as Date).toISOString()).toBe('2026-07-02T20:00:00.000Z');
    expect((row.forecastAt as Date).toISOString()).toBe('2026-07-02T21:00:00.000Z');
    expect(row.temperatureC).toBe('22.00');
    expect(row.humidityPct).toBe('90.00');
    expect(row.precipitationMm).toBe('0.00');
    expect(row.precipitationProbPct).toBe('30.00');
    expect(row.windSpeedMs).toBe('1.00');
    expect(row.skyCode).toBe('4');
  });

  it('warns once per unmapped grid and skips those rows', () => {
    const rows: KmaVilageFcstRow[] = [
      { ...fcstRow('TMP', '20'), nx: 1, ny: 1 },
      { ...fcstRow('REH', '50'), nx: 1, ny: 1 },
    ];

    const result = transformKmaVilageFcstRows(rows, context);

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe('unmapped_kma_grid');
  });
});
