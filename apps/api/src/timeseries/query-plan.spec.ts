import {
  GenerationHourlyQuerySchema,
  RecDailyQuerySchema,
  SmpHourlyQuerySchema,
} from '@solar/api-contracts';
import { describe, expect, it } from 'vitest';
import {
  encodeGenerationDailyCursor,
  encodeRecDailyCursor,
  encodeSmpHourlyCursor,
} from './cursor';
import {
  buildGenerationQueryPlan,
  buildRecDailyQueryPlan,
  buildSmpHourlyQueryPlan,
  GENERATION_RAW_MAX_RANGE_DAYS,
  SMP_MAX_RANGE_DAYS,
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

  it('defaults SMP to the last 7 KST days ending at latest source_date', () => {
    const query = SmpHourlyQuerySchema.parse({});
    const plan = buildSmpHourlyQueryPlan(query, '2026-07-03');

    expect(plan.from).toBe('2026-06-27');
    expect(plan.to).toBe('2026-07-03');
    expect(plan.rangeDays).toBe(7);
    expect(plan.defaultedFrom).toBe(true);
    expect(plan.defaultedTo).toBe(true);
    expect(plan.latestAvailableSourceDate).toBe('2026-07-03');
  });

  it('falls back SMP anchor to today KST when the mart is empty', () => {
    const query = SmpHourlyQuerySchema.parse({});
    const plan = buildSmpHourlyQueryPlan(query, null, new Date('2026-07-04T03:00:00.000Z'));

    expect(plan.to).toBe('2026-07-04');
    expect(plan.latestAvailableSourceDate).toBeNull();
  });

  it('rejects SMP ranges wider than the max', () => {
    const query = SmpHourlyQuerySchema.parse({
      from: '2026-01-01',
      to: '2026-03-01',
    });

    expect(() => buildSmpHourlyQueryPlan(query, '2026-07-03')).toThrow(
      `SMP range cannot exceed ${SMP_MAX_RANGE_DAYS} days`,
    );
  });

  it('decodes SMP cursor into the query plan', () => {
    const cursor = encodeSmpHourlyCursor({
      intervalStartAt: '2026-07-01T15:00:00.000Z',
      marketArea: 'JEJU',
    });
    const query = SmpHourlyQuerySchema.parse({
      from: '2026-07-01',
      to: '2026-07-03',
      area: 'JEJU',
      cursor,
      limit: '48',
    });
    const plan = buildSmpHourlyQueryPlan(query, '2026-07-03');

    expect(plan.area).toBe('JEJU');
    expect(plan.limit).toBe(48);
    expect(plan.cursor).toEqual({
      intervalStartAt: '2026-07-01T15:00:00.000Z',
      marketArea: 'JEJU',
    });
  });

  it('rejects a generation cursor on the SMP endpoint', () => {
    const foreignCursor = encodeGenerationDailyCursor({
      sourceDate: '2026-01-15',
      regionCode: 'SEOUL',
    });
    const query = SmpHourlyQuerySchema.parse({ cursor: foreignCursor });

    expect(() => buildSmpHourlyQueryPlan(query, '2026-07-03')).toThrow(
      'cursor does not match this endpoint',
    );
  });
});
