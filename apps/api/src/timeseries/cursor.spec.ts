import { describe, expect, it } from 'vitest';
import {
  decodeGenerationDailyCursor,
  decodeGenerationHourlyCursor,
  decodeRecDailyCursor,
  encodeGenerationDailyCursor,
  encodeGenerationHourlyCursor,
  encodeRecDailyCursor,
} from './cursor';
import { TimeseriesQueryError } from './timeseries-query-error';

describe('timeseries cursors', () => {
  it('round-trips generation hourly cursor payloads', () => {
    const cursor = encodeGenerationHourlyCursor({
      intervalStartAt: '2026-06-01T00:00:00.000Z',
      regionCode: 'SEOUL',
    });

    expect(decodeGenerationHourlyCursor(cursor)).toEqual({
      intervalStartAt: '2026-06-01T00:00:00.000Z',
      regionCode: 'SEOUL',
    });
  });

  it('round-trips generation daily cursor payloads', () => {
    const cursor = encodeGenerationDailyCursor({
      sourceDate: '2026-06-01',
      regionCode: 'SEOUL',
    });

    expect(decodeGenerationDailyCursor(cursor)).toEqual({
      sourceDate: '2026-06-01',
      regionCode: 'SEOUL',
    });
  });

  it('round-trips REC daily cursor payloads', () => {
    const cursor = encodeRecDailyCursor({
      tradeDate: '2026-06-02',
      marketArea: 'TOTAL',
    });

    expect(decodeRecDailyCursor(cursor)).toEqual({
      tradeDate: '2026-06-02',
      marketArea: 'TOTAL',
    });
  });

  it('rejects malformed and wrong-kind cursors', () => {
    const hourlyCursor = encodeGenerationHourlyCursor({
      intervalStartAt: '2026-06-01T00:00:00.000Z',
      regionCode: 'SEOUL',
    });

    expect(() => decodeGenerationHourlyCursor('not-json')).toThrow(TimeseriesQueryError);
    expect(() => decodeRecDailyCursor(hourlyCursor)).toThrow('cursor does not match this endpoint');
  });

  it('returns null for missing cursors', () => {
    expect(decodeGenerationHourlyCursor(undefined)).toBeNull();
    expect(decodeRecDailyCursor(undefined)).toBeNull();
  });
});
