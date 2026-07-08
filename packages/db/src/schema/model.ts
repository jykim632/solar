import { sql } from 'drizzle-orm';
import {
  bigserial,
  jsonb,
  numeric,
  text,
  timestamp,
  unique,
  check,
  pgTable,
} from 'drizzle-orm/pg-core';
import { region } from './region';

/**
 * Model layer (§9.7) — forecast results with the actual value backfilled for
 * MAE/MAPE evaluation (§12.3). UNIQUE over (run, target, region, fuel, model)
 * lets the same target be re-forecast by different runs/models without clobber.
 */
export const modelGenerationForecastHourly = pgTable(
  'model_generation_forecast_hourly',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    forecastRunAt: timestamp('forecast_run_at', { withTimezone: true }).notNull(),
    targetAt: timestamp('target_at', { withTimezone: true }).notNull(),
    regionCode: text('region_code')
      .notNull()
      .references(() => region.regionCode),
    fuelType: text('fuel_type').notNull(),
    predictedGenerationMwh: numeric('predicted_generation_mwh', {
      precision: 12,
      scale: 3,
    }).notNull(),
    actualGenerationMwh: numeric('actual_generation_mwh', { precision: 12, scale: 3 }),
    modelName: text('model_name').notNull(),
    modelVersion: text('model_version'),
    featureSnapshot: jsonb('feature_snapshot')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check('model_generation_forecast_hourly_fuel_type_ck', sql`${t.fuelType} IN ('SOLAR','WIND')`),
    check('model_generation_forecast_hourly_predicted_ck', sql`${t.predictedGenerationMwh} >= 0`),
    check(
      'model_generation_forecast_hourly_actual_ck',
      sql`${t.actualGenerationMwh} IS NULL OR ${t.actualGenerationMwh} >= 0`,
    ),
    unique('model_generation_forecast_hourly_uq').on(
      t.forecastRunAt,
      t.targetAt,
      t.regionCode,
      t.fuelType,
      t.modelName,
    ),
  ],
);
