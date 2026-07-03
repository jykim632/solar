import { TimeseriesQueryError } from './timeseries-query-error';

/**
 * KST 날짜 헬퍼 (§6 시간 정책). from/to는 KST 일자 의미 —
 * interval_start_at >= from 00:00 KST AND < (to+1일) 00:00 KST.
 * worker의 core.ts와 동일 규약이지만 workspace 경계상 별도 구현.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const KST_TIMEZONE = 'Asia/Seoul' as const;

export interface IsoDateParts {
  year: number;
  month: number;
  day: number;
}

export interface KstUtcRange {
  fromUtc: Date;
  toExclusiveUtc: Date;
}

export function parseIsoDateParts(date: string, path = 'date'): IsoDateParts {
  if (!ISO_DATE_RE.test(date)) {
    throw new TimeseriesQueryError(path, `${path} must be YYYY-MM-DD`);
  }

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const normalized = new Date(Date.UTC(year, month - 1, day));

  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    throw new TimeseriesQueryError(path, `${path} is not a valid calendar date`);
  }

  return { year, month, day };
}

export function isoDateToKstStartUtcDate(date: string, path = 'date'): Date {
  const { year, month, day } = parseIsoDateParts(date, path);
  return new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
}

export function addDaysToIsoDate(date: string, days: number, path = 'date'): string {
  const parsed = parseIsoDateParts(date, path);
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return next.toISOString().slice(0, 10);
}

export function kstDateRangeToUtc(from: string, to: string): KstUtcRange {
  return {
    fromUtc: isoDateToKstStartUtcDate(from, 'from'),
    toExclusiveUtc: isoDateToKstStartUtcDate(addDaysToIsoDate(to, 1, 'to'), 'to'),
  };
}

export function inclusiveDayCount(from: string, to: string): number {
  const fromParts = parseIsoDateParts(from, 'from');
  const toParts = parseIsoDateParts(to, 'to');
  const fromMs = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toMs = Date.UTC(toParts.year, toParts.month - 1, toParts.day);

  if (fromMs > toMs) {
    throw new TimeseriesQueryError('from', 'from must be earlier than or equal to to');
  }

  return Math.floor((toMs - fromMs) / MS_PER_DAY) + 1;
}

export function currentKstDate(now = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
