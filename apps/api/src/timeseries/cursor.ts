import type { RecMarketArea } from '@solar/api-contracts';
import { parseIsoDateParts } from './kst';
import { TimeseriesQueryError } from './timeseries-query-error';

/**
 * Opaque cursor (base64url JSON). keyset 페이지네이션의 정렬 키를 담는다 —
 * kind 필드로 endpoint 간 오용을 차단하고, 잘못된 cursor는 400.
 */
type CursorKind = 'generation-hourly' | 'generation-daily' | 'rec-daily';

export interface GenerationHourlyCursor {
  intervalStartAt: string;
  regionCode: string;
}

export interface GenerationDailyCursor {
  sourceDate: string;
  regionCode: string;
}

export interface RecDailyCursor {
  tradeDate: string;
  marketArea: RecMarketArea;
}

const REC_MARKET_AREAS = ['LAND', 'JEJU', 'TOTAL'] as const;

export function encodeGenerationHourlyCursor(cursor: GenerationHourlyCursor): string {
  return encodeCursor({ v: 1, kind: 'generation-hourly', ...cursor });
}

export function encodeGenerationDailyCursor(cursor: GenerationDailyCursor): string {
  return encodeCursor({ v: 1, kind: 'generation-daily', ...cursor });
}

export function encodeRecDailyCursor(cursor: RecDailyCursor): string {
  return encodeCursor({ v: 1, kind: 'rec-daily', ...cursor });
}

export function decodeGenerationHourlyCursor(
  cursor: string | undefined,
): GenerationHourlyCursor | null {
  const payload = decodeRawCursor(cursor, 'generation-hourly');
  if (payload === null) {
    return null;
  }

  return {
    intervalStartAt: requireIsoInstant(payload.intervalStartAt, 'intervalStartAt'),
    regionCode: requireNonEmptyString(payload.regionCode, 'regionCode'),
  };
}

export function decodeGenerationDailyCursor(
  cursor: string | undefined,
): GenerationDailyCursor | null {
  const payload = decodeRawCursor(cursor, 'generation-daily');
  if (payload === null) {
    return null;
  }

  return {
    sourceDate: requireIsoDate(payload.sourceDate, 'sourceDate'),
    regionCode: requireNonEmptyString(payload.regionCode, 'regionCode'),
  };
}

export function decodeRecDailyCursor(cursor: string | undefined): RecDailyCursor | null {
  const payload = decodeRawCursor(cursor, 'rec-daily');
  if (payload === null) {
    return null;
  }

  const marketArea = requireNonEmptyString(payload.marketArea, 'marketArea');
  if (!REC_MARKET_AREAS.includes(marketArea as RecMarketArea)) {
    throw cursorError('cursor marketArea is invalid');
  }

  return {
    tradeDate: requireIsoDate(payload.tradeDate, 'tradeDate'),
    marketArea: marketArea as RecMarketArea,
  };
}

function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeRawCursor(
  cursor: string | undefined,
  expectedKind: CursorKind,
): Record<string, unknown> | null {
  if (cursor === undefined) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw cursorError('cursor is not a valid timeseries cursor');
  }

  if (!isRecord(decoded) || decoded.v !== 1 || decoded.kind !== expectedKind) {
    throw cursorError('cursor does not match this endpoint');
  }

  return decoded;
}

function requireIsoInstant(value: unknown, key: string): string {
  const instant = requireNonEmptyString(value, key);
  const parsed = new Date(instant);

  if (!instant.endsWith('Z') || Number.isNaN(parsed.getTime())) {
    throw cursorError(`cursor ${key} is invalid`);
  }

  return instant;
}

function requireIsoDate(value: unknown, key: string): string {
  const date = requireNonEmptyString(value, key);
  parseIsoDateParts(date, 'cursor');
  return date;
}

function requireNonEmptyString(value: unknown, key: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw cursorError(`cursor ${key} is required`);
  }

  return value;
}

function cursorError(message: string): TimeseriesQueryError {
  return new TimeseriesQueryError('cursor', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
