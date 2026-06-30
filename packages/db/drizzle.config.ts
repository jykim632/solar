import { defineConfig } from 'drizzle-kit';

/**
 * Migrations MUST run against the DIRECT (non-pooled) Neon url.
 * drizzle-kit over the pooler can hang/abort on DDL — CLAUDE.md / §14.2
 * require `migration=direct`. The app runtime keeps using the pooled url.
 */
const url = process.env.DATABASE_DIRECT_URL;
if (!url) {
  throw new Error(
    'DATABASE_DIRECT_URL is required for migrations (use the direct, non-pooled Neon url).',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url },
  // raw/staging/mart/model/ops schema separation (CLAUDE.md 데이터 레이어).
  schemaFilter: ['raw', 'staging', 'mart', 'model', 'ops', 'public'],
  strict: true,
  verbose: true,
});
