/**
 * Drizzle schema barrel. Tables are organized by data layer via table-name
 * prefix in a single schema (raw_ / stg_ / mart_ / model_ / ops_), per §9.0 —
 * PG namespaces are avoided (cross-schema FK + drizzle-kit multi-schema cost).
 *
 * Deferred to solar-8wv.9 (auth FK gate): the §9.8 service-domain tables
 * (organization_profile, plant, plant_access_grant, audit_log) reference
 * auth_organization.id / auth_user.id. Their FK column types can only be fixed
 * after Better Auth's generated id type is introspected — added there, not here.
 */
export * from './region';
export * from './ops';
export * from './mart';
export * from './model';
