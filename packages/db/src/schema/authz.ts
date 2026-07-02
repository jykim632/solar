import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  date,
  index,
  inet,
  jsonb,
  numeric,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './_shared';
import { authOrganization, authUser } from './auth';
import { region } from './region';

/**
 * Service-domain authorization tables (developer_plan.md section 9.8).
 * These are app-owned tables, so they use the shared app timestamp helpers and
 * named house-style constraints.
 */

export const organizationProfile = pgTable(
  'organization_profile',
  {
    organizationId: text('organization_id')
      .primaryKey()
      .references(() => authOrganization.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    organizationType: text('organization_type').notNull(),
    businessRegistrationNo: text('business_registration_no'),
    defaultRegionCode: text('default_region_code').references(() => region.regionCode),
    createdAt,
    updatedAt,
  },
  (t) => [
    check(
      'organization_profile_organization_type_ck',
      sql`${t.organizationType} IN ('internal','om_company','generator')`,
    ),
  ],
);

export const plant = pgTable(
  'plant',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizationProfile.organizationId, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    regionCode: text('region_code').references(() => region.regionCode),
    marketArea: text('market_area'),
    capacityKw: numeric('capacity_kw', { precision: 12, scale: 3 }),
    commissionedOn: date('commissioned_on'),
    address: text('address'),
    lat: numeric('lat', { precision: 9, scale: 6 }),
    lon: numeric('lon', { precision: 9, scale: 6 }),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt,
    updatedAt,
  },
  (t) => [
    check('plant_market_area_ck', sql`${t.marketArea} IN ('LAND','JEJU')`),
    check('plant_capacity_kw_ck', sql`${t.capacityKw} >= 0`),
    index('plant_organization_id_idx').on(t.organizationId),
  ],
);

export const plantAccessGrant = pgTable(
  'plant_access_grant',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    plantId: bigint('plant_id', { mode: 'bigint' })
      .notNull()
      .references(() => plant.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    grantedBy: text('granted_by').references(() => authUser.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    unique('plant_access_grant_plant_user_uq').on(t.plantId, t.userId),
    check('plant_access_grant_permission_ck', sql`${t.permission} IN ('viewer','analyst','admin')`),
    index('plant_access_grant_user_id_idx').on(t.userId),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    organizationId: text('organization_id').references(() => organizationProfile.organizationId, {
      onDelete: 'set null',
    }),
    actorUserId: text('actor_user_id').references(() => authUser.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt,
  },
  (t) => [
    index('audit_log_organization_created_idx').on(t.organizationId, t.createdAt.desc()),
  ],
);
