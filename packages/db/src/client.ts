import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

/**
 * App-runtime db client. Uses the POOLED url (DATABASE_URL).
 * Migrations/seed use DATABASE_DIRECT_URL instead (see drizzle.config.ts).
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required (use the pooled Neon url for app runtime).');
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
export type Db = typeof db;
