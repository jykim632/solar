import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  date,
  integer,
  numeric,
  text,
  timestamp,
  unique,
  index,
  check,
  pgTable,
} from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';
import { datasource, opsIngestionRun } from './ops';
import { region } from './region';

/**
 * Mart tables (§9.3–§9.6) — screen/API query-optimized. All measurement and
 * price columns carry explicit NUMERIC precision + CHECK ranges (§9.0), and
 * hourly tables enforce interval_end = interval_start + 1h. UNIQUE keys use
 * the source natural key + datasource_id to block duplicate ingestion.
 */

/** §9.3 발전량 (MWh). */
export const martGenerationHourly = pgTable(
  'mart_generation_hourly',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    intervalStartAt: timestamp('interval_start_at', { withTimezone: true }).notNull(),
    intervalEndAt: timestamp('interval_end_at', { withTimezone: true }).notNull(),
    sourceDate: date('source_date').notNull(),
    sourceHour: integer('source_hour').notNull(),
    regionCode: text('region_code')
      .notNull()
      .references(() => region.regionCode),
    fuelType: text('fuel_type').notNull(),
    generationMwh: numeric('generation_mwh', { precision: 12, scale: 3 }).notNull(),
    includesEss: boolean('includes_ess'),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    createdAt,
  },
  (t) => [
    check('mart_generation_hourly_source_hour_ck', sql`${t.sourceHour} BETWEEN 0 AND 24`),
    check('mart_generation_hourly_fuel_type_ck', sql`${t.fuelType} IN ('SOLAR','WIND')`),
    check('mart_generation_hourly_generation_ck', sql`${t.generationMwh} >= 0`),
    check(
      'mart_generation_hourly_interval_ck',
      sql`${t.intervalEndAt} = ${t.intervalStartAt} + interval '1 hour'`,
    ),
    unique('mart_generation_hourly_uq').on(
      t.intervalStartAt,
      t.regionCode,
      t.fuelType,
      t.datasourceId,
    ),
    index('mart_generation_hourly_region_fuel_start_idx').on(
      t.regionCode,
      t.fuelType,
      t.intervalStartAt.desc(),
    ),
  ],
);

/** §9.4 기상 단기예보. 예보는 빠르게 증가 — 보관/파티션 정책은 도입 시점 검토. */
export const martWeatherForecastHourly = pgTable(
  'mart_weather_forecast_hourly',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    baseAt: timestamp('base_at', { withTimezone: true }).notNull(),
    forecastAt: timestamp('forecast_at', { withTimezone: true }).notNull(),
    regionCode: text('region_code')
      .notNull()
      .references(() => region.regionCode),
    temperatureC: numeric('temperature_c', { precision: 5, scale: 2 }),
    humidityPct: numeric('humidity_pct', { precision: 5, scale: 2 }),
    precipitationMm: numeric('precipitation_mm', { precision: 7, scale: 2 }),
    precipitationProbPct: numeric('precipitation_prob_pct', { precision: 5, scale: 2 }),
    windSpeedMs: numeric('wind_speed_ms', { precision: 5, scale: 2 }),
    skyCode: text('sky_code'),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    createdAt,
  },
  (t) => [
    unique('mart_weather_forecast_hourly_uq').on(
      t.baseAt,
      t.forecastAt,
      t.regionCode,
      t.datasourceId,
    ),
    index('mart_weather_forecast_hourly_region_forecast_idx').on(t.regionCode, t.forecastAt),
  ],
);

/** §9.4 위성 일사량. 30분 간격. UTC/KST 이중 시각 정합성 CHECK. */
export const martSolarIrradiance = pgTable(
  'mart_solar_irradiance',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    observedAtUtc: timestamp('observed_at_utc', { withTimezone: true }).notNull(),
    observedAtKst: timestamp('observed_at_kst', { withTimezone: true }).notNull(),
    regionCode: text('region_code')
      .notNull()
      .references(() => region.regionCode),
    irradianceValue: numeric('irradiance_value', { precision: 10, scale: 3 }),
    irradianceUnit: text('irradiance_unit'),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    createdAt,
  },
  (t) => [
    check(
      'mart_solar_irradiance_utc_kst_ck',
      sql`${t.observedAtKst} = ${t.observedAtUtc} + interval '9 hours'`,
    ),
    unique('mart_solar_irradiance_uq').on(t.observedAtUtc, t.regionCode, t.datasourceId),
    index('mart_solar_irradiance_region_observed_idx').on(t.regionCode, t.observedAtKst.desc()),
  ],
);

/** §9.5 SMP (원/kWh). 육지/제주 구분 필수. 자릿수 이상 탐지 CHECK. */
export const martSmpHourly = pgTable(
  'mart_smp_hourly',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    intervalStartAt: timestamp('interval_start_at', { withTimezone: true }).notNull(),
    intervalEndAt: timestamp('interval_end_at', { withTimezone: true }).notNull(),
    sourceDate: date('source_date').notNull(),
    sourceHour: integer('source_hour').notNull(),
    marketArea: text('market_area').notNull(),
    smpKrwPerKwh: numeric('smp_krw_per_kwh', { precision: 10, scale: 2 }).notNull(),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    createdAt,
  },
  (t) => [
    check('mart_smp_hourly_source_hour_ck', sql`${t.sourceHour} BETWEEN 0 AND 24`),
    check('mart_smp_hourly_market_area_ck', sql`${t.marketArea} IN ('LAND','JEJU')`),
    check('mart_smp_hourly_value_ck', sql`${t.smpKrwPerKwh} BETWEEN 0 AND 1000`),
    check(
      'mart_smp_hourly_interval_ck',
      sql`${t.intervalEndAt} = ${t.intervalStartAt} + interval '1 hour'`,
    ),
    unique('mart_smp_hourly_uq').on(t.intervalStartAt, t.marketArea, t.datasourceId),
    index('mart_smp_hourly_area_start_idx').on(t.marketArea, t.intervalStartAt.desc()),
  ],
);

/** §9.5 REC 현물시장 (일별). close/total 통합값은 market_area='TOTAL' 행에만. */
export const martRecMarketDaily = pgTable(
  'mart_rec_market_daily',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    tradeDate: date('trade_date').notNull(),
    marketArea: text('market_area').notNull(),
    tradeCount: integer('trade_count'),
    volumeRec: numeric('volume_rec', { precision: 14, scale: 3 }),
    avgPriceKrwPerRec: numeric('avg_price_krw_per_rec', { precision: 12, scale: 2 }),
    highPriceKrwPerRec: numeric('high_price_krw_per_rec', { precision: 12, scale: 2 }),
    lowPriceKrwPerRec: numeric('low_price_krw_per_rec', { precision: 12, scale: 2 }),
    closePriceKrwPerRec: numeric('close_price_krw_per_rec', { precision: 12, scale: 2 }),
    totalTradeAmountKrw: numeric('total_trade_amount_krw', { precision: 18, scale: 2 }),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    createdAt,
  },
  (t) => [
    check('mart_rec_market_daily_market_area_ck', sql`${t.marketArea} IN ('LAND','JEJU','TOTAL')`),
    unique('mart_rec_market_daily_uq').on(t.tradeDate, t.marketArea, t.datasourceId),
    index('mart_rec_market_daily_area_date_idx').on(t.marketArea, t.tradeDate.desc()),
  ],
);

/** §9.6 전력수급 실시간. observed_at을 5분 경계로 정규화한 slot_at을 UNIQUE 키로. */
export const martSupplyRealtime = pgTable(
  'mart_supply_realtime',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    slotAt: timestamp('slot_at', { withTimezone: true }).notNull(),
    supplyAbilityMw: numeric('supply_ability_mw', { precision: 10, scale: 2 }),
    currentDemandMw: numeric('current_demand_mw', { precision: 10, scale: 2 }),
    forecastLoadMw: numeric('forecast_load_mw', { precision: 10, scale: 2 }),
    reservePowerMw: numeric('reserve_power_mw', { precision: 10, scale: 2 }),
    reserveRatePct: numeric('reserve_rate_pct', { precision: 5, scale: 2 }),
    operatingReservePowerMw: numeric('operating_reserve_power_mw', { precision: 10, scale: 2 }),
    operatingReserveRatePct: numeric('operating_reserve_rate_pct', { precision: 5, scale: 2 }),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    createdAt,
  },
  (t) => [
    unique('mart_supply_realtime_uq').on(t.slotAt, t.datasourceId),
    index('mart_supply_realtime_slot_idx').on(t.slotAt.desc()),
  ],
);

/** §9.6 수요 시간별 (MWh). */
export const martDemandHourly = pgTable(
  'mart_demand_hourly',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    intervalStartAt: timestamp('interval_start_at', { withTimezone: true }).notNull(),
    intervalEndAt: timestamp('interval_end_at', { withTimezone: true }).notNull(),
    demandMwh: numeric('demand_mwh', { precision: 12, scale: 3 }).notNull(),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    createdAt,
  },
  (t) => [
    check('mart_demand_hourly_value_ck', sql`${t.demandMwh} >= 0`),
    check(
      'mart_demand_hourly_interval_ck',
      sql`${t.intervalEndAt} = ${t.intervalStartAt} + interval '1 hour'`,
    ),
    unique('mart_demand_hourly_uq').on(t.intervalStartAt, t.datasourceId),
  ],
);
