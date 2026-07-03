import { GenerationHourlyQuerySchema, RecDailyQuerySchema } from '@solar/api-contracts';
import { describe, expect, it } from 'vitest';
import { encodeGenerationDailyCursor, encodeRecDailyCursor } from './cursor';
import {
  buildGenerationQueryPlan,
  buildRecDailyQueryPlan,
  GENERATION_RAW_MAX_RANGE_DAYS,
} from './query-plan';

describe('timeseries query plans', () => {
  it('defaults generation to the last 31 KST days ending at latest source_date', () => {
    const query = GenerationHourlyQuerySchema.parse({});
    const plan = buildGenerationQueryPlan(query, '2026-06-30');

    expect(plan.bucket).toBe('hourly');
    expect(plan.from).toBe('2026-05-31');
    expect(plan.to).toBe('2026-06-30');
    expect(plan.rangeDays).toBe(31);
    expect(plan.defaultedFrom).toBe(true);
    expect(plan.defaultedTo).toBe(true);
    expect(plan.latestAvailableSourceDate).toBe('2026-06-30');
  });

  it('requires bucket=daily for generation ranges wider than raw max', () => {
    const query = GenerationHourlyQuerySchema.parse({
      from: '2026-01-01',
      to: '2026-02-01',
    });

    expect(() => buildGenerationQueryPlan(query, '2026-06-30')).toThrow(
      `bucket=daily is required for generation ranges longer than ${GENERATION_RAW_MAX_RANGE_DAYS} days`,
    );
  });

  it('accepts daily generation plans and decodes daily cursors', () => {
    const cursor = encodeGenerationDailyCursor({
      sourceDate: '2026-01-15',
      regionCode: 'SEOUL',
    });
    const query = GenerationHourlyQuerySchema.parse({
      from: '2026-01-01',
      to: '2026-02-01',
      bucket: 'daily',
      cursor,
      limit: '50',
    });
    const plan = buildGenerationQueryPlan(query, '2026-06-30');

    expect(plan.bucket).toBe('daily');
    if (plan.bucket !== 'daily') {
      throw new Error('Expected daily plan.');
    }

    expect(plan.cursor).toEqual({
      sourceDate: '2026-01-15',
      regionCode: 'SEOUL',
    });
    expect(plan.limit).toBe(50);
  });

  it('defaults REC to the last 90 KST days ending today', () => {
    const query = RecDailyQuerySchema.parse({});
    const plan = buildRecDailyQueryPlan(query, new Date('2026-07-03T03:00:00.000Z'));

    expect(plan.from).toBe('2026-04-05');
    expect(plan.to).toBe('2026-07-03');
    expect(plan.rangeDays).toBe(90);
    expect(plan.defaultedFrom).toBe(true);
    expect(plan.defaultedTo).toBe(true);
  });

  it('decodes REC cursor into the query plan', () => {
    const cursor = encodeRecDailyCursor({
      tradeDate: '2026-06-02',
      marketArea: 'TOTAL',
    });
    const query = RecDailyQuerySchema.parse({
      from: '2026-06-01',
      to: '2026-06-30',
      cursor,
    });
    const plan = buildRecDailyQueryPlan(query);

    expect(plan.cursor).toEqual({
      tradeDate: '2026-06-02',
      marketArea: 'TOTAL',
    });
  });
});
