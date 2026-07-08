import { describe, expect, it } from 'vitest';
import {
  addDaysToIsoDate,
  currentKstDate,
  inclusiveDayCount,
  isoDateToKstStartUtcDate,
  kstDateRangeToUtc,
} from './kst';

describe('KST date helpers', () => {
  it('maps KST dates to UTC instants', () => {
    expect(isoDateToKstStartUtcDate('2025-12-31').toISOString()).toBe('2025-12-30T15:00:00.000Z');

    const range = kstDateRangeToUtc('2025-12-31', '2026-01-02');
    expect(range.fromUtc.toISOString()).toBe('2025-12-30T15:00:00.000Z');
    expect(range.toExclusiveUtc.toISOString()).toBe('2026-01-02T15:00:00.000Z');
  });

  it('adds days using calendar-date semantics', () => {
    expect(addDaysToIsoDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToIsoDate('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('counts inclusive ranges and rejects reversed ranges', () => {
    expect(inclusiveDayCount('2026-06-01', '2026-06-30')).toBe(30);
    expect(() => inclusiveDayCount('2026-06-30', '2026-06-01')).toThrow(
      'from must be earlier than or equal to to',
    );
  });

  it('derives the current KST date from UTC now', () => {
    expect(currentKstDate(new Date('2026-07-02T14:59:59.000Z'))).toBe('2026-07-02');
    expect(currentKstDate(new Date('2026-07-02T15:00:00.000Z'))).toBe('2026-07-03');
  });

  it('rejects invalid calendar dates', () => {
    expect(() => isoDateToKstStartUtcDate('2026-02-31')).toThrow(
      'date is not a valid calendar date',
    );
  });
});
