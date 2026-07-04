import type {
  FuelType,
  GenerationBucket,
  GenerationHourlyQuery,
  MarketArea,
  RecDailyQuery,
  RecMarketArea,
  SmpHourlyQuery,
} from '@solar/api-contracts';
import {
  decodeGenerationDailyCursor,
  decodeGenerationHourlyCursor,
  decodeRecDailyCursor,
  decodeSmpHourlyCursor,
  type GenerationDailyCursor,
  type GenerationHourlyCursor,
  type RecDailyCursor,
  type SmpHourlyCursor,
} from './cursor';
import { addDaysToIsoDate, currentKstDate, inclusiveDayCount, kstDateRangeToUtc } from './kst';
import { TimeseriesQueryError } from './timeseries-query-error';

/**
 * 순수 쿼리 플랜 빌더 — range 기본값/가드(§10 line 671)와 cursor 해석을
 * DB 접근 없이 결정한다 (단위 테스트 대상).
 *
 * 발전량 기본 범위는 "최신 source_date 기준 최근 31일" — 원천이 월 단위
 * 갱신(lag ~2개월)이라 오늘 기준 기본값이면 항상 빈 결과가 나온다.
 */
export const GENERATION_DEFAULT_RANGE_DAYS = 31;
export const GENERATION_RAW_MAX_RANGE_DAYS = 31;
export const GENERATION_DAILY_MAX_RANGE_DAYS = 366 * 5;
export const REC_DEFAULT_RANGE_DAYS = 90;
export const REC_MAX_RANGE_DAYS = 366 * 5;
// SMP는 하루 48행(24h×육지/제주) — 31일이면 limit 1000 안쪽. 하루전 예측
// 소스라 max(source_date)가 내일일 수 있어 기본 to는 latest 앵커를 쓴다.
export const SMP_DEFAULT_RANGE_DAYS = 7;
export const SMP_MAX_RANGE_DAYS = 31;

interface BaseGenerationQueryPlan {
  region: string | undefined;
  fuelType: FuelType;
  from: string;
  to: string;
  fromUtc: Date;
  toExclusiveUtc: Date;
  rangeDays: number;
  limit: number;
  defaultedFrom: boolean;
  defaultedTo: boolean;
  latestAvailableSourceDate: string | null;
}

export type GenerationQueryPlan = GenerationHourlyQueryPlan | GenerationDailyQueryPlan;

export interface GenerationHourlyQueryPlan extends BaseGenerationQueryPlan {
  bucket: 'hourly';
  cursor: GenerationHourlyCursor | null;
}

export interface GenerationDailyQueryPlan extends BaseGenerationQueryPlan {
  bucket: 'daily';
  cursor: GenerationDailyCursor | null;
}

export interface RecDailyQueryPlan {
  area: RecMarketArea | undefined;
  from: string;
  to: string;
  rangeDays: number;
  limit: number;
  defaultedFrom: boolean;
  defaultedTo: boolean;
  cursor: RecDailyCursor | null;
}

export interface SmpHourlyQueryPlan {
  area: MarketArea | undefined;
  from: string;
  to: string;
  fromUtc: Date;
  toExclusiveUtc: Date;
  rangeDays: number;
  limit: number;
  defaultedFrom: boolean;
  defaultedTo: boolean;
  latestAvailableSourceDate: string | null;
  cursor: SmpHourlyCursor | null;
}

export function buildGenerationQueryPlan(
  query: GenerationHourlyQuery,
  latestAvailableSourceDate: string | null,
  now = new Date(),
): GenerationQueryPlan {
  const fallbackTo = latestAvailableSourceDate ?? currentKstDate(now);
  const to = query.to ?? fallbackTo;
  const from = query.from ?? addDaysToIsoDate(to, 1 - GENERATION_DEFAULT_RANGE_DAYS, 'to');
  const rangeDays = inclusiveDayCount(from, to);
  const bucket: GenerationBucket = query.bucket ?? 'hourly';

  if (rangeDays > GENERATION_DAILY_MAX_RANGE_DAYS) {
    throw new TimeseriesQueryError(
      'to',
      `generation range cannot exceed ${GENERATION_DAILY_MAX_RANGE_DAYS} days`,
    );
  }

  if (bucket === 'hourly' && rangeDays > GENERATION_RAW_MAX_RANGE_DAYS) {
    throw new TimeseriesQueryError(
      'bucket',
      `bucket=daily is required for generation ranges longer than ${GENERATION_RAW_MAX_RANGE_DAYS} days`,
    );
  }

  const utcRange = kstDateRangeToUtc(from, to);
  const base = {
    region: query.region,
    fuelType: query.fuelType,
    from,
    to,
    fromUtc: utcRange.fromUtc,
    toExclusiveUtc: utcRange.toExclusiveUtc,
    rangeDays,
    limit: query.limit,
    defaultedFrom: query.from === undefined,
    defaultedTo: query.to === undefined,
    latestAvailableSourceDate,
  };

  if (bucket === 'daily') {
    return {
      ...base,
      bucket,
      cursor: decodeGenerationDailyCursor(query.cursor),
    };
  }

  return {
    ...base,
    bucket,
    cursor: decodeGenerationHourlyCursor(query.cursor),
  };
}

export function buildSmpHourlyQueryPlan(
  query: SmpHourlyQuery,
  latestAvailableSourceDate: string | null,
  now = new Date(),
): SmpHourlyQueryPlan {
  const fallbackTo = latestAvailableSourceDate ?? currentKstDate(now);
  const to = query.to ?? fallbackTo;
  const from = query.from ?? addDaysToIsoDate(to, 1 - SMP_DEFAULT_RANGE_DAYS, 'to');
  const rangeDays = inclusiveDayCount(from, to);

  if (rangeDays > SMP_MAX_RANGE_DAYS) {
    throw new TimeseriesQueryError('to', `SMP range cannot exceed ${SMP_MAX_RANGE_DAYS} days`);
  }

  const utcRange = kstDateRangeToUtc(from, to);

  return {
    area: query.area,
    from,
    to,
    fromUtc: utcRange.fromUtc,
    toExclusiveUtc: utcRange.toExclusiveUtc,
    rangeDays,
    limit: query.limit,
    defaultedFrom: query.from === undefined,
    defaultedTo: query.to === undefined,
    latestAvailableSourceDate,
    cursor: decodeSmpHourlyCursor(query.cursor),
  };
}

export function buildRecDailyQueryPlan(query: RecDailyQuery, now = new Date()): RecDailyQueryPlan {
  const to = query.to ?? currentKstDate(now);
  const from = query.from ?? addDaysToIsoDate(to, 1 - REC_DEFAULT_RANGE_DAYS, 'to');
  const rangeDays = inclusiveDayCount(from, to);

  if (rangeDays > REC_MAX_RANGE_DAYS) {
    throw new TimeseriesQueryError('to', `REC range cannot exceed ${REC_MAX_RANGE_DAYS} days`);
  }

  return {
    area: query.area,
    from,
    to,
    rangeDays,
    limit: query.limit,
    defaultedFrom: query.from === undefined,
    defaultedTo: query.to === undefined,
    cursor: decodeRecDailyCursor(query.cursor),
  };
}
