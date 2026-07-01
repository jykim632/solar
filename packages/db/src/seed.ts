import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { region } from './schema/region';

/**
 * DB seed. Uses DATABASE_DIRECT_URL (same as migrations — this is admin-side
 * setup, not app runtime). Currently seeds only the mandatory 'UNKNOWN' region
 * sentinel (§9.0): NOT NULL region_code FKs point here when the source region
 * can't be resolved, keeping UNIQUE integrity intact. datasource rows and the
 * region grid table are seeded once §5/§15 mappings are confirmed.
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

  await db
    .insert(region)
    .values({ regionCode: 'UNKNOWN', regionName: '미상' })
    .onConflictDoNothing({ target: region.regionCode });

  // eslint-disable-next-line no-console
  console.log('[seed] ensured region UNKNOWN sentinel.');
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
