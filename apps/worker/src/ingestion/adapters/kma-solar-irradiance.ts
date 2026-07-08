import { sql } from 'drizzle-orm';
import type { Db } from '@solar/db';
import { martSolarIrradiance } from '@solar/db/schema';
import {
  addMinutes,
  utcYmdHmToUtcDate,
  type DataQualityCheckResult,
  type FetchIntervalContext,
  type FetchIntervalResult,
  type IngestionAdapter,
  type IngestionRegionRow,
  type QualityCheckInput,
  type TransformContext,
  type TransformIssue,
  type TransformResult,
} from '../core.js';

/**
 * KMA API허브 위성 AI 일사량 adapter (§9.4).
 * 실응답 검증(data/samples/solar-irradiance-point-2026-07-03.txt):
 * 변수 AI-DSR, 30분 슬롯, **UTC 시간**, 단위 MJ/㎡, 요청당 최대 24슬롯
 * → 하루(48슬롯)는 2회 분할. ymd는 UTC 일자로 해석(dateRangeMode='utc-day').
 * region의 시도 대표 lat/lon 17개 루프 (17×2=34 req/day).
 * data.go.kr envelope가 아닌 pipe-구분 텍스트 응답 — fetchInterval 직접 구현.
 */
const BASE_URL = 'https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph_sun_sat_ana_txt';
const INTERVAL_MINUTES = 30;
const IRRADIANCE_UNIT = 'MJ/m2';

export interface IrradianceChunk {
  tm1: string;
  tm2: string;
}

export interface ParsedIrradianceText {
  slots: string[];
  values: (number | null)[];
}

export interface KmaSolarIrradianceRawRow {
  regionCode: string;
  observedAtUtc: Date;
  value: number | null;
}

export type KmaSolarIrradianceMartRow = typeof martSolarIrradiance.$inferInsert;

/** 하루(UTC)를 24슬롯 제한에 맞춰 2개 요청 구간으로 분할. */
export function buildIrradianceChunks(ymd: string): IrradianceChunk[] {
  if (!/^\d{8}$/.test(ymd)) {
    throw new Error('ymd must be YYYYMMDD.');
  }

  return [
    { tm1: `${ymd}0000`, tm2: `${ymd}1130` },
    { tm1: `${ymd}1200`, tm2: `${ymd}2330` },
  ];
}

export function parseIrradianceText(text: string): ParsedIrradianceText {
  if (text.includes('<Error>')) {
    throw new Error(`KMA APIHub error response: ${text.slice(0, 200)}`);
  }

  const tableRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map(parsePipeCells)
    .filter((cells) => cells.length > 0);

  const headerIndex = tableRows.findIndex(
    (cells) => cells[0] === 'TMFC' && cells[1] === 'VAR' && cells[2] === 'LON' && cells[3] === 'LAT',
  );

  if (headerIndex < 0) {
    throw new Error('KMA irradiance header row was not found.');
  }

  const header = tableRows[headerIndex];
  if (!header) {
    throw new Error('KMA irradiance header row was not found.');
  }

  const dataRow = tableRows
    .slice(headerIndex + 1)
    .find((cells) => cells.length >= 5 && cells[1] !== 'VAR');

  if (!dataRow) {
    throw new Error('KMA irradiance data row was not found.');
  }

  const slots = header.slice(4).filter((slot) => slot.length > 0);
  const valueCells = dataRow.slice(4);
  const values = slots.map((_, index) => parseIrradianceValue(valueCells[index] ?? ''));

  return { slots, values };
}

export async function fetchKmaSolarIrradianceInterval(
  context: FetchIntervalContext,
): Promise<FetchIntervalResult> {
  const apiKey = context.apiKeys.kmaApiHub;
  if (!apiKey) {
    throw new Error('KMA_API_KEY is required for kma-solar-irradiance.');
  }

  const rows: KmaSolarIrradianceRawRow[] = [];

  for (const regionRow of context.regionRows) {
    if (regionRow.lat == null || regionRow.lon == null) {
      continue;
    }

    for (const chunk of buildIrradianceChunks(context.ymd)) {
      const url = buildKmaSolarIrradianceUrl({
        apiKey,
        tm1: chunk.tm1,
        tm2: chunk.tm2,
        lat: regionRow.lat,
        lon: regionRow.lon,
      });

      const response = await context.fetchImpl(url, {
        headers: { 'user-agent': 'solar-worker/0.1' },
      });
      const bodyText = await response.text();

      await context.saveRaw({
        url,
        body: bodyText,
        httpStatus: response.status,
        contentType: 'text/plain',
        fileExtension: 'txt',
        metadata: {
          regionCode: regionRow.regionCode,
          lat: regionRow.lat,
          lon: regionRow.lon,
          tm1: chunk.tm1,
          tm2: chunk.tm2,
          int: INTERVAL_MINUTES,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from kma-solar-irradiance.`);
      }

      const parsed = parseIrradianceText(bodyText);

      for (let index = 0; index < parsed.slots.length; index += 1) {
        const slot = parsed.slots[index];
        if (!slot) {
          continue;
        }

        rows.push({
          regionCode: regionRow.regionCode,
          observedAtUtc: parseIrradianceSlotToUtcDate(slot, context.ymd),
          value: parsed.values[index] ?? null,
        });
      }
    }
  }

  return { rows };
}

export function transformKmaSolarIrradianceRows(
  rows: unknown[],
  context: TransformContext,
): { rows: KmaSolarIrradianceMartRow[]; issues: TransformIssue[] } {
  const martRows: KmaSolarIrradianceMartRow[] = [];
  const issues: TransformIssue[] = [];

  for (const row of rows) {
    const rawRow = coerceKmaSolarIrradianceRawRow(row);

    if (!rawRow) {
      issues.push({
        code: 'invalid_irradiance_row',
        severity: 'warn',
        message: 'Invalid KMA solar irradiance intermediate row.',
      });
      continue;
    }

    let irradianceValue: string | null = null;

    if (rawRow.value != null) {
      if (rawRow.value < 0) {
        issues.push({
          code: 'negative_irradiance_value',
          severity: 'warn',
          message: 'KMA solar irradiance value was negative.',
          details: {
            regionCode: rawRow.regionCode,
            observedAtUtc: rawRow.observedAtUtc.toISOString(),
            value: rawRow.value,
          },
        });
      } else {
        irradianceValue = rawRow.value.toFixed(3);
      }
    }

    martRows.push({
      observedAtUtc: rawRow.observedAtUtc,
      // §6.4 UTC/KST 병행 저장 — mart CHECK(kst = utc + 9h)와 정합.
      observedAtKst: addMinutes(rawRow.observedAtUtc, 9 * 60),
      regionCode: rawRow.regionCode,
      irradianceValue,
      irradianceUnit: IRRADIANCE_UNIT,
      datasourceId: context.datasourceId,
      ingestionRunId: context.ingestionRunId,
    });
  }

  return { rows: martRows, issues };
}

export function qualityCheckKmaSolarIrradiance(input: {
  ymd: string;
  rawRows: KmaSolarIrradianceRawRow[];
  martRows: KmaSolarIrradianceMartRow[];
  issues: TransformIssue[];
  regionRows: readonly IngestionRegionRow[];
}): DataQualityCheckResult[] {
  const expectedRegionCodes = expectedIrradianceRegionCodes(input.regionRows);
  const coveredRegionCodes = [...new Set(input.martRows.map((row) => row.regionCode))].sort();
  const missingRegionCodes = expectedRegionCodes.filter(
    (code) => !coveredRegionCodes.includes(code),
  );
  const nullRows = input.martRows.filter((row) => row.irradianceValue == null).length;
  const nullRate = input.martRows.length === 0 ? 1 : nullRows / input.martRows.length;
  const failIssues = input.issues.filter((issue) => issue.severity === 'fail');
  const warnIssues = input.issues.filter((issue) => issue.severity === 'warn');

  return [
    {
      checkName: 'kma_solar_irradiance.row_count',
      status: input.rawRows.length > 0 ? 'pass' : 'fail',
      details: {
        ymd: input.ymd,
        rawRows: input.rawRows.length,
        martRows: input.martRows.length,
      },
    },
    {
      checkName: 'kma_solar_irradiance.region_coverage',
      status: missingRegionCodes.length === 0 ? 'pass' : 'fail',
      details: {
        ymd: input.ymd,
        expectedRegions: expectedRegionCodes.length,
        coveredRegions: coveredRegionCodes.length,
        missingRegionCodes,
      },
    },
    {
      // 야간 슬롯은 null이 정상적으로 많을 수 있어 임계는 넉넉히 — 관측 후 조정.
      checkName: 'kma_solar_irradiance.null_rate',
      status:
        input.martRows.length === 0
          ? 'fail'
          : nullRate <= 0.05
            ? 'pass'
            : nullRate <= 0.6
              ? 'warn'
              : 'fail',
      details: {
        ymd: input.ymd,
        martRows: input.martRows.length,
        nullRows,
        nullRate,
      },
    },
    {
      checkName: 'kma_solar_irradiance.transform_issues',
      status: failIssues.length > 0 ? 'fail' : warnIssues.length > 0 ? 'warn' : 'pass',
      details: {
        ymd: input.ymd,
        failCount: failIssues.length,
        warnCount: warnIssues.length,
        issueCodes: [...new Set(input.issues.map((issue) => issue.code))],
      },
    },
  ];
}

export async function upsertKmaSolarIrradianceRows(
  db: Db,
  rows: KmaSolarIrradianceMartRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await db
    .insert(martSolarIrradiance)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        martSolarIrradiance.observedAtUtc,
        martSolarIrradiance.regionCode,
        martSolarIrradiance.datasourceId,
      ],
      set: {
        observedAtKst: sql`excluded.observed_at_kst`,
        irradianceValue: sql`excluded.irradiance_value`,
        irradianceUnit: sql`excluded.irradiance_unit`,
        ingestionRunId: sql`excluded.ingestion_run_id`,
      },
    });

  return rows.length;
}

export const kmaSolarIrradianceAdapter: IngestionAdapter = {
  key: 'kma-solar-irradiance',
  datasourceName: 'kma-solar-irradiance',
  provider: 'KMA-APIHUB',
  requiredApiKeys: ['kmaApiHub'],
  // 위성 일사량 슬롯은 UTC — ymd를 UTC 일자로 해석한다.
  dateRangeMode: 'utc-day',

  fetchInterval: fetchKmaSolarIrradianceInterval,

  transformRows(rows, context): TransformResult {
    return transformKmaSolarIrradianceRows(rows, context);
  },

  qualityChecks(input: QualityCheckInput) {
    return qualityCheckKmaSolarIrradiance({
      ymd: input.ymd,
      rawRows: input.rawRows as KmaSolarIrradianceRawRow[],
      martRows: input.martRows as KmaSolarIrradianceMartRow[],
      issues: input.issues,
      regionRows: input.regionRows,
    });
  },

  upsertMart(db, rows) {
    return upsertKmaSolarIrradianceRows(db, rows as KmaSolarIrradianceMartRow[]);
  },
};

function buildKmaSolarIrradianceUrl(input: {
  apiKey: string;
  tm1: string;
  tm2: string;
  lat: string;
  lon: string;
}): string {
  const params = new URLSearchParams({
    tm1: input.tm1,
    tm2: input.tm2,
    int: String(INTERVAL_MINUTES),
    lon: input.lon,
    lat: input.lat,
    authKey: input.apiKey,
  });

  return `${BASE_URL}?${params.toString()}`;
}

function parsePipeCells(line: string): string[] {
  const rawCells = line.split('|');
  const first = rawCells[0] ?? '';
  const last = rawCells[rawCells.length - 1] ?? '';
  const startIndex = first.trim() === '' ? 1 : 0;
  const endIndex = last.trim() === '' ? rawCells.length - 1 : rawCells.length;

  return rawCells.slice(startIndex, endIndex).map((cell) => cell.trim());
}

function parseIrradianceValue(value: string): number | null {
  const normalized = value.trim();

  if (normalized === '' || normalized === '-9' || normalized === '-99' || normalized === '-999') {
    return null;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid KMA irradiance value "${value}".`);
  }

  return numeric;
}

function parseIrradianceSlotToUtcDate(slot: string, fallbackYmd: string): Date {
  if (/^\d{12}$/.test(slot)) {
    return utcYmdHmToUtcDate(slot.slice(0, 8), slot.slice(8, 12));
  }

  if (/^\d{4}$/.test(slot)) {
    return utcYmdHmToUtcDate(fallbackYmd, slot);
  }

  throw new Error(`Invalid KMA irradiance slot "${slot}".`);
}

function coerceKmaSolarIrradianceRawRow(row: unknown): KmaSolarIrradianceRawRow | null {
  if (!isRecord(row)) {
    return null;
  }

  if (typeof row.regionCode !== 'string' || row.regionCode.length === 0) {
    return null;
  }

  const observedAtUtc = coerceDate(row.observedAtUtc);
  if (!observedAtUtc) {
    return null;
  }

  const rawValue = row.value;
  if (rawValue !== null && typeof rawValue !== 'number') {
    return null;
  }

  if (typeof rawValue === 'number' && !Number.isFinite(rawValue)) {
    return null;
  }

  return {
    regionCode: row.regionCode,
    observedAtUtc,
    value: rawValue,
  };
}

function coerceDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;

  if (!date || !Number.isFinite(date.getTime())) {
    return null;
  }

  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function expectedIrradianceRegionCodes(regionRows: readonly IngestionRegionRow[]): string[] {
  const codes = new Set<string>();

  for (const row of regionRows) {
    if (row.lat != null && row.lon != null) {
      codes.add(row.regionCode);
    }
  }

  return [...codes].sort();
}
