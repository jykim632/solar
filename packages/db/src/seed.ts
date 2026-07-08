import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { datasource } from './schema/ops';
import { region } from './schema/region';
import { datasourceSeedRows } from './seed-data/datasources';
import { regionSeedRows } from './seed-data/regions';

/**
 * DB seed. Uses DATABASE_DIRECT_URL (same as migrations — this is admin-side
 * setup, not app runtime). Region rows (UNKNOWN sentinel + 시도 17, §9.0/§9.2)
 * and datasource rows are idempotent: existing keys are left untouched so
 * later corrections go through migrations, not re-seeding.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_DIRECT_URL;
  if (!url) {
    throw new Error(
      'DATABASE_DIRECT_URL is required for seeding (use the direct, non-pooled url).',
    );
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  try {
    await db
      .insert(region)
      .values(regionSeedRows)
      .onConflictDoNothing({ target: region.regionCode });

    await db
      .insert(datasource)
      .values(datasourceSeedRows)
      .onConflictDoNothing({ target: [datasource.name, datasource.provider] });

    // eslint-disable-next-line no-console
    console.log(`[seed] ensured ${regionSeedRows.length} region rows (UNKNOWN + 시도 17).`);
    // eslint-disable-next-line no-console
    console.log(`[seed] ensured ${datasourceSeedRows.length} datasource rows.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
