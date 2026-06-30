import { z } from 'zod';

/** RBAC roles (developer_plan.md §10.4). platform_admin is cross-org. */
export const RoleSchema = z.enum(['platform_admin', 'owner', 'admin', 'analyst', 'viewer']);
export type Role = z.infer<typeof RoleSchema>;

/** SMP market areas — land vs Jeju are settled separately (§6.2, §13.3). */
export const MarketAreaSchema = z.enum(['LAND', 'JEJU']);
export type MarketArea = z.infer<typeof MarketAreaSchema>;

/** Generation fuel types tracked in mart.generation_hourly (§9.3). */
export const FuelTypeSchema = z.enum(['SOLAR', 'WIND']);
export type FuelType = z.infer<typeof FuelTypeSchema>;

/** Standard error envelope returned by the NestJS api on validation/auth failures. */
export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** ISO date string (YYYY-MM-DD), validated as a real calendar date. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid calendar date');
