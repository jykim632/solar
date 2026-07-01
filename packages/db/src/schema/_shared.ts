import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Timestamp conventions (§9.0):
 * - every created_at is NOT NULL DEFAULT now()
 * - updated_at uses Drizzle $onUpdate(() => new Date())
 * All app timestamps are timestamptz (withTimezone). KST display values are
 * derived in adapters/queries, not stored as naive local time.
 */
export const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());
