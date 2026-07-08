/**
 * Drizzle schema barrel. Tables are organized by data layer via table-name
 * prefix in a single schema (auth_ / raw_ / stg_ / mart_ / model_ / ops_),
 * per section 9.0. PG namespaces are avoided (cross-schema FK + drizzle-kit
 * multi-schema cost).
 *
 * Migration ownership gate for solar-8wv.9: drizzle-kit in packages/db owns
 * all migrations, including Better Auth auth_* tables. Better Auth CLI
 * migrations are intentionally not used; apps/web maps Better Auth models to
 * these prefixed tables at adapter setup time.
 */
export * from './auth';
export * from './region';
export * from './ops';
export * from './mart';
export * from './model';
export * from './authz';
