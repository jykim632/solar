import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  integer,
  jsonb,
  serial,
  text,
  timestamp,
  unique,
  index,
  check,
  pgTable,
} from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';

/**
 * Ops / common tables (§9.1). Layer is encoded by table-name prefix per §9.0
 * (single schema, no PG namespaces): datasource is a config/lookup table,
 * ingestion_run/data_quality_check are ops_*, raw_object keeps its name.
 */

export const datasource = pgTable(
  'datasource',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    // 수집 kill switch (solar-up3): false면 worker가 run 기록 없이 skip.
    enabled: boolean('enabled').notNull().default(true),
    sourceType: text('source_type').notNull(),
    updateCycle: text('update_cycle'),
    url: text('url'),
    license: text('license'),
    note: text('note'),
    createdAt,
  },
  (t) => [unique('datasource_name_provider_uq').on(t.name, t.provider)],
);

export const opsIngestionRun = pgTable(
  'ops_ingestion_run',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status').notNull(),
    requestedFrom: timestamp('requested_from', { withTimezone: true }),
    requestedTo: timestamp('requested_to', { withTimezone: true }),
    rowCount: integer('row_count').default(0),
    errorMessage: text('error_message'),
    createdAt,
  },
  (t) => [
    check(
      'ops_ingestion_run_status_ck',
      sql`${t.status} IN ('running','success','failed','partial')`,
    ),
    index('ops_ingestion_run_datasource_started_idx').on(t.datasourceId, t.startedAt.desc()),
  ],
);

export const rawObject = pgTable(
  'raw_object',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    datasourceId: integer('datasource_id')
      .notNull()
      .references(() => datasource.id),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' })
      .notNull()
      .references(() => opsIngestionRun.id),
    objectPath: text('object_path').notNull(),
    contentType: text('content_type'),
    contentHash: text('content_hash').notNull(),
    sourceUrl: text('source_url'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    // 동일 응답 재수집 멱등 처리 (§9.1)
    unique('raw_object_datasource_hash_uq').on(t.datasourceId, t.contentHash),
    index('raw_object_datasource_fetched_idx').on(t.datasourceId, t.fetchedAt.desc()),
  ],
);

export const opsDataQualityCheck = pgTable(
  'ops_data_quality_check',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    ingestionRunId: bigint('ingestion_run_id', { mode: 'bigint' }).references(
      () => opsIngestionRun.id,
    ),
    checkName: text('check_name').notNull(),
    status: text('status').notNull(),
    details: jsonb('details').default(sql`'{}'::jsonb`),
    createdAt,
  },
  (t) => [check('ops_data_quality_check_status_ck', sql`${t.status} IN ('pass','warn','fail')`)],
);
