import { sql } from 'drizzle-orm';
import type { Db } from '@solar/db';
import { martWeatherForecastHourly } from '@solar/db/schema';
import {
  DATA_GO_KR_OK,
  DataGoKrEnvelopeSchema,
  KmaVilageFcstRowsSchema,
  type KmaVilageFcstRow,
} from '@solar/ingestion-schemas';
import {
  kstYmdHmToUtcDate,
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
 * KMA 단기예보 getVilageFcst adapter (§9.4).
 * base_time=0500 KST 고정(일 1회 수집 기준 — 발표시각 02/05/.../23시 중
 * 당일 전체 예보가 실리는 아침 발표분). region의 nx/ny 17개를 루프하며,
 * category rows를 (fcstDate,fcstTime,region) 단위 mart row로 pivot한다.
 * TMN/TMX(일 최저/최고)는 hourly mart 대상 아님 — 제외.
 */
const BASE_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const BASE_TIME = '0500';
const NUM_OF_ROWS = 1000;

const WEATHER_NULL_RATE_FIELDS = [
  'temperatureC',
  'humidityPct',
  'precipitationMm',
  'precipitationProbPct',
  'windSpeedMs',
  'skyCode',
] as const;

type WeatherNullRateField = (typeof WEATHER_NULL_RATE_FIELDS)[number];

export type KmaVilageFcstMartRow = typeof martWeatherForecastHourly.$inferInsert;

function buildKmaVilageFcstUrl(input: {
  apiKey: string;
  ymd: string;
  pageNo: number;
  nx: number;
  ny: number;
}): string {
  const params = new URLSearchParams({
    pageNo: String(input.pageNo),
    numOfRows: String(NUM_OF_ROWS),
    dataType: 'JSON',
    base_date: input.ymd,
    base_time: BASE_TIME,
    nx: String(input.nx),
    ny: String(input.ny),
  });

  return `${BASE_URL}?serviceKey=${input.apiKey}&${params.toString()}`;
}

export async function fetchKmaVilageFcstInterval(
  context: FetchIntervalContext,
): Promise<FetchIntervalResult> {
  const apiKey = context.apiKeys.dataGoKr;
  if (!apiKey) {
    throw new Error('DATA_GO_KR_API_KEY is required for kma-vilage-fcst.');
  }

  const rows: unknown[] = [];

  for (const regionRow of context.regionRows) {
    if (regionRow.kmaGridX == null || regionRow.kmaGridY == null) {
      continue;
    }

    let pageNo = 1;
    let regionRawRows = 0;

    while (true) {
      const url = buildKmaVilageFcstUrl({
        apiKey,
        ymd: context.ymd,
        pageNo,
        nx: regionRow.kmaGridX,
        ny: regionRow.kmaGridY,
      });

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
        metadata: {
          baseTime: BASE_TIME,
          pageNo,
          regionCode: regionRow.regionCode,
          nx: regionRow.kmaGridX,
          ny: regionRow.kmaGridY,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from kma-vilage-fcst.`);
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

      const envelopeBody = envelope.response.body;
      const items = envelopeBody?.items?.item ?? [];
      rows.push(...items);
      regionRawRows += items.length;

      const totalCount = envelopeBody?.totalCount ?? regionRawRows;
      const responseNumOfRows = envelopeBody?.numOfRows ?? NUM_OF_ROWS;

      if (totalCount === 0 || items.length === 0 || regionRawRows >= totalCount) {
        break;
      }

      pageNo += 1;

      if (pageNo > Math.ceil(totalCount / Math.max(responseNumOfRows, 1)) + 1) {
        break;
      }
    }
  }

  return { rows };
}

/**
 * PCP(1시간 강수량) 버킷 문자열 파싱. KMA 문서 기준:
 * 강수없음→0, "1.0mm 미만"→0.5(중간값), "a.a~b.bmm"→하한, "50.0mm 이상"→50.
 */
export function parsePcpValue(value: string): number | null {
  const normalized = value.trim();

  if (normalized === '강수없음') {
    return 0;
  }

  if (normalized === '1.0mm 미만') {
    return 0.5;
  }

  const exactMatch = /^(\d+(?:\.\d+)?)mm$/.exec(normalized);
  if (exactMatch?.[1]) {
    return Number(exactMatch[1]);
  }

  const rangeMatch = /^(\d+(?:\.\d+)?)~(\d+(?:\.\d+)?)mm$/.exec(normalized);
  if (rangeMatch?.[1]) {
    return Number(rangeMatch[1]);
  }

  const lowerBoundMatch = /^(\d+(?:\.\d+)?)mm 이상$/.exec(normalized);
  if (lowerBoundMatch?.[1]) {
    return Number(lowerBoundMatch[1]);
  }

  return null;
}

export function transformKmaVilageFcstRows(
  rows: unknown[],
  context: TransformContext,
): { rows: KmaVilageFcstMartRow[]; issues: TransformIssue[] } {
  const sourceRows = KmaVilageFcstRowsSchema.parse(rows);
  const gridRegionMap = buildKmaGridRegionMap(context.regionRows);
  const martRowsByKey = new Map<string, KmaVilageFcstMartRow>();
  const issues: TransformIssue[] = [];
  const unmappedGridIssueKeys = new Set<string>();

  for (const row of sourceRows) {
    if (row.category === 'TMN' || row.category === 'TMX') {
      continue;
    }

    const grid = gridKey(row.nx, row.ny);
    const regionCode = gridRegionMap.get(grid);

    if (!regionCode) {
      if (!unmappedGridIssueKeys.has(grid)) {
        unmappedGridIssueKeys.add(grid);
        issues.push({
          code: 'unmapped_kma_grid',
          severity: 'warn',
          message: `No region mapping for KMA grid nx=${row.nx}, ny=${row.ny}.`,
          details: { nx: row.nx, ny: row.ny },
        });
      }
      continue;
    }

    if (!isWeatherMartCategory(row.category)) {
      continue;
    }

    const key = `${row.fcstDate}:${row.fcstTime}:${regionCode}`;
    let martRow = martRowsByKey.get(key);

    if (!martRow) {
      martRow = {
        baseAt: kstYmdHmToUtcDate(row.baseDate, row.baseTime),
        forecastAt: kstYmdHmToUtcDate(row.fcstDate, row.fcstTime),
        regionCode,
        temperatureC: null,
        humidityPct: null,
        precipitationMm: null,
        precipitationProbPct: null,
        windSpeedMs: null,
        skyCode: null,
        datasourceId: context.datasourceId,
        ingestionRunId: context.ingestionRunId,
      };
      martRowsByKey.set(key, martRow);
    }

    switch (row.category) {
      case 'TMP':
        martRow.temperatureC = formatNumericFcstValue(row, 2, issues);
        break;
      case 'REH':
        martRow.humidityPct = formatNumericFcstValue(row, 2, issues);
        break;
      case 'PCP': {
        const precipitationMm = parsePcpValue(row.fcstValue);
        if (precipitationMm == null) {
          issues.push({
            code: 'unknown_pcp_value',
            severity: 'warn',
            message: `Unknown KMA PCP value "${row.fcstValue}".`,
            details: sourceRowDetails(row),
          });
        }
        martRow.precipitationMm = precipitationMm == null ? null : precipitationMm.toFixed(2);
        break;
      }
      case 'POP':
        martRow.precipitationProbPct = formatNumericFcstValue(row, 2, issues);
        break;
      case 'WSD':
        martRow.windSpeedMs = formatNumericFcstValue(row, 2, issues);
        break;
      case 'SKY':
        martRow.skyCode = row.fcstValue.trim() || null;
        break;
      default:
        break;
    }
  }

  return { rows: [...martRowsByKey.values()], issues };
}

export function qualityCheckKmaVilageFcst(input: {
  ymd: string;
  rawRows: KmaVilageFcstRow[];
  martRows: KmaVilageFcstMartRow[];
  issues: TransformIssue[];
  regionRows: readonly IngestionRegionRow[];
}): DataQualityCheckResult[] {
  const expectedRegionCodes = expectedForecastRegionCodes(input.regionRows);
  const coveredRegionCodes = [...new Set(input.martRows.map((row) => row.regionCode))].sort();
  const missingRegionCodes = expectedRegionCodes.filter(
    (code) => !coveredRegionCodes.includes(code),
  );
  const nullCounts = createWeatherNullCounts();

  for (const row of input.martRows) {
    for (const field of WEATHER_NULL_RATE_FIELDS) {
      if (row[field] == null) {
        nullCounts[field] += 1;
      }
    }
  }

  const nullRates = createWeatherNullRates(nullCounts, input.martRows.length);
  // PCP는 예보 후반부(모레 이후) 시간대에 제공되지 않는 게 정상이라 제외 —
  // 실측 null율 ~20% (2026-07-03). 나머지 필드만 엄격 검사.
  const strictFields = WEATHER_NULL_RATE_FIELDS.filter((field) => field !== 'precipitationMm');
  const maxNullRate = strictFields.reduce((max, field) => Math.max(max, nullRates[field]), 0);

  const failIssues = input.issues.filter((issue) => issue.severity === 'fail');
  const warnIssues = input.issues.filter((issue) => issue.severity === 'warn');

  return [
    {
      checkName: 'kma_vilage_fcst.row_count',
      status: input.rawRows.length > 0 ? 'pass' : 'fail',
      details: {
        ymd: input.ymd,
        rawRows: input.rawRows.length,
        martRows: input.martRows.length,
      },
    },
    {
      checkName: 'kma_vilage_fcst.region_coverage',
      status: missingRegionCodes.length === 0 ? 'pass' : 'fail',
      details: {
        ymd: input.ymd,
        expectedRegions: expectedRegionCodes.length,
        coveredRegions: coveredRegionCodes.length,
        missingRegionCodes,
      },
    },
    {
      checkName: 'kma_vilage_fcst.null_rate',
      status:
        input.martRows.length === 0
          ? 'fail'
          : maxNullRate === 0
            ? 'pass'
            : maxNullRate <= 0.05
              ? 'warn'
              : 'fail',
      details: {
        ymd: input.ymd,
        martRows: input.martRows.length,
        nullCounts,
        nullRates,
      },
    },
    {
      checkName: 'kma_vilage_fcst.transform_issues',
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

export async function upsertKmaVilageFcstRows(
  db: Db,
  rows: KmaVilageFcstMartRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await db
    .insert(martWeatherForecastHourly)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        martWeatherForecastHourly.baseAt,
        martWeatherForecastHourly.forecastAt,
        martWeatherForecastHourly.regionCode,
        martWeatherForecastHourly.datasourceId,
      ],
      set: {
        temperatureC: sql`excluded.temperature_c`,
        humidityPct: sql`excluded.humidity_pct`,
        precipitationMm: sql`excluded.precipitation_mm`,
        precipitationProbPct: sql`excluded.precipitation_prob_pct`,
        windSpeedMs: sql`excluded.wind_speed_ms`,
        skyCode: sql`excluded.sky_code`,
        ingestionRunId: sql`excluded.ingestion_run_id`,
      },
    });

  return rows.length;
}

export const kmaVilageFcstAdapter: IngestionAdapter = {
  key: 'kma-vilage-fcst',
  datasourceName: 'kma-vilage-fcst',
  provider: 'KMA',
  requiredApiKeys: ['dataGoKr'],
  dateRangeMode: 'kst-day',

  fetchInterval: fetchKmaVilageFcstInterval,

  transformRows(rows, context): TransformResult {
    return transformKmaVilageFcstRows(rows, context);
  },

  qualityChecks(input: QualityCheckInput) {
    return qualityCheckKmaVilageFcst({
      ymd: input.ymd,
      rawRows: input.rawRows as KmaVilageFcstRow[],
      martRows: input.martRows as KmaVilageFcstMartRow[],
      issues: input.issues,
      regionRows: input.regionRows,
    });
  },

  upsertMart(db, rows) {
    return upsertKmaVilageFcstRows(db, rows as KmaVilageFcstMartRow[]);
  },
};

function buildKmaGridRegionMap(regionRows: readonly IngestionRegionRow[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const row of regionRows) {
    if (row.kmaGridX != null && row.kmaGridY != null) {
      map.set(gridKey(row.kmaGridX, row.kmaGridY), row.regionCode);
    }
  }

  return map;
}

function gridKey(nx: number, ny: number): string {
  return `${nx}:${ny}`;
}

function isWeatherMartCategory(category: KmaVilageFcstRow['category']): boolean {
  return (
    category === 'TMP' ||
    category === 'REH' ||
    category === 'PCP' ||
    category === 'POP' ||
    category === 'WSD' ||
    category === 'SKY'
  );
}

function formatNumericFcstValue(
  row: KmaVilageFcstRow,
  fractionDigits: number,
  issues: TransformIssue[],
): string | null {
  const numeric = Number(row.fcstValue);

  if (!Number.isFinite(numeric)) {
    issues.push({
      code: 'invalid_numeric_fcst_value',
      severity: 'warn',
      message: `Invalid numeric KMA ${row.category} value "${row.fcstValue}".`,
      details: sourceRowDetails(row),
    });
    return null;
  }

  return numeric.toFixed(fractionDigits);
}

function sourceRowDetails(row: KmaVilageFcstRow): Record<string, unknown> {
  return {
    baseDate: row.baseDate,
    baseTime: row.baseTime,
    category: row.category,
    fcstDate: row.fcstDate,
    fcstTime: row.fcstTime,
    fcstValue: row.fcstValue,
    nx: row.nx,
    ny: row.ny,
  };
}

function expectedForecastRegionCodes(regionRows: readonly IngestionRegionRow[]): string[] {
  const codes = new Set<string>();

  for (const row of regionRows) {
    if (row.kmaGridX != null && row.kmaGridY != null) {
      codes.add(row.regionCode);
    }
  }

  return [...codes].sort();
}

function createWeatherNullCounts(): Record<WeatherNullRateField, number> {
  return {
    temperatureC: 0,
    humidityPct: 0,
    precipitationMm: 0,
    precipitationProbPct: 0,
    windSpeedMs: 0,
    skyCode: 0,
  };
}

function createWeatherNullRates(
  nullCounts: Record<WeatherNullRateField, number>,
  martRowCount: number,
): Record<WeatherNullRateField, number> {
  if (martRowCount === 0) {
    return {
      temperatureC: 1,
      humidityPct: 1,
      precipitationMm: 1,
      precipitationProbPct: 1,
      windSpeedMs: 1,
      skyCode: 1,
    };
  }

  return {
    temperatureC: nullCounts.temperatureC / martRowCount,
    humidityPct: nullCounts.humidityPct / martRowCount,
    precipitationMm: nullCounts.precipitationMm / martRowCount,
    precipitationProbPct: nullCounts.precipitationProbPct / martRowCount,
    windSpeedMs: nullCounts.windSpeedMs / martRowCount,
    skyCode: nullCounts.skyCode / martRowCount,
  };
}
