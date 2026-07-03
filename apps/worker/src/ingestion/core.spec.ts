import { describe, expect, it } from 'vitest';
import { kstDateHourToUtcDate, resolveRequestedDateRange } from './core.js';

describe('KST date helpers', () => {
  it('maps KST hour to UTC timestamp', () => {
    expect(kstDateHourToUtcDate('20251231', 0).toISOString()).toBe('2025-12-30T15:00:00.000Z');
    expect(kstDateHourToUtcDate('20251231', 23).toISOString()).toBe('2025-12-31T14:00:00.000Z');
  });

  it('rejects invalid calendar dates and hours', () => {
    expect(() => kstDateHourToUtcDate('20250231', 0)).toThrow('not a valid calendar date');
    expect(() => kstDateHourToUtcDate('20251231', 24)).toThrow('hour must be 0..23');
  });

  it('uses inclusive YYYYMMDD CLI range and exclusive requestedTo', () => {
    const range = resolveRequestedDateRange({ from: '20251231', to: '20260102' });

    expect(range.ymds).toEqual(['20251231', '20260101', '20260102']);
    expect(range.requestedFrom.toISOString()).toBe('2025-12-30T15:00:00.000Z');
    expect(range.requestedTo.toISOString()).toBe('2026-01-02T15:00:00.000Z');
  });

  it('defaults to previous KST day', () => {
    // 2026-07-03 12:00 KST (03:00 UTC) → 어제는 2026-07-02.
    const now = new Date('2026-07-03T03:00:00.000Z');
    const range = resolveRequestedDateRange({}, now);

    expect(range.fromYmd).toBe('20260702');
    expect(range.toYmd).toBe('20260702');
  });

  it('crosses KST midnight correctly when UTC date differs', () => {
    // 2026-07-03 08:00 KST = 2026-07-02 23:00 UTC → 어제(KST)는 7/2.
    const now = new Date('2026-07-02T23:00:00.000Z');
    const range = resolveRequestedDateRange({}, now);

    expect(range.fromYmd).toBe('20260702');
  });

  it('rejects reversed ranges', () => {
    expect(() => resolveRequestedDateRange({ from: '20260102', to: '20260101' })).toThrow(
      '--from must be earlier',
    );
  });
});
