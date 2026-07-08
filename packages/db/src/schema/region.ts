import { sql } from 'drizzle-orm';
import { integer, numeric, text, pgTable, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';

/**
 * Region dimension (§9.2). region_code is the standardized key referenced by
 * all time-series tables. A 'UNKNOWN' sentinel row is seeded so NOT NULL FK
 * columns can represent "region unknown" without breaking UNIQUE integrity (§9.0).
 * kma_grid_x/y assume 1 region : 1 grid; split to region_grid_mapping if needed.
 * kpx_region_name is the adapter reverse-lookup key (KPX 응답 지역명 →
 * region_code) — partial unique so the mapping stays unambiguous (UNKNOWN=null).
 */
export const region = pgTable(
  'region',
  {
    regionCode: text('region_code').primaryKey(),
    regionName: text('region_name').notNull(),
    kpxRegionName: text('kpx_region_name'),
    kmaGridX: integer('kma_grid_x'),
    kmaGridY: integer('kma_grid_y'),
    lat: numeric('lat', { precision: 9, scale: 6 }),
    lon: numeric('lon', { precision: 9, scale: 6 }),
    sidoName: text('sido_name'),
    sigunguName: text('sigungu_name'),
    createdAt,
  },
  (t) => [
    uniqueIndex('region_kpx_region_name_uq')
      .on(t.kpxRegionName)
      .where(sql`${t.kpxRegionName} IS NOT NULL`),
  ],
);
