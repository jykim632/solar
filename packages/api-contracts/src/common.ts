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

/** Error codes for the standard API envelope (developer_plan.md §10, §15.3). */
export const ApiErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const ApiErrorCodeSchema = z.enum([
  ApiErrorCode.VALIDATION_FAILED,
  ApiErrorCode.UNAUTHORIZED,
  ApiErrorCode.FORBIDDEN,
  ApiErrorCode.NOT_FOUND,
  ApiErrorCode.CONFLICT,
  ApiErrorCode.RATE_LIMITED,
  ApiErrorCode.INTERNAL,
]);

/** Validation issue details exposed by the API without leaking raw Zod internals. */
export const ApiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

/** Standard error envelope returned by the NestJS API (developer_plan.md §10). */
export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  details: z.array(ApiErrorDetailSchema).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiErrorCodeByHttpStatus = {
  400: ApiErrorCode.VALIDATION_FAILED,
  401: ApiErrorCode.UNAUTHORIZED,
  403: ApiErrorCode.FORBIDDEN,
  404: ApiErrorCode.NOT_FOUND,
  409: ApiErrorCode.CONFLICT,
  429: ApiErrorCode.RATE_LIMITED,
  500: ApiErrorCode.INTERNAL,
} as const satisfies Record<number, ApiErrorCode>;

export function apiErrorCodeForHttpStatus(status: number): ApiErrorCode {
  return ApiErrorCodeByHttpStatus[status as keyof typeof ApiErrorCodeByHttpStatus] ?? ApiErrorCode.INTERNAL;
}

/** ISO date string (YYYY-MM-DD), validated as a real calendar date. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid calendar date');
