import { z } from 'zod';
import type { ApiErrorDetail } from '@solar/api-contracts';
import { zodErrorToApiErrorDetails } from '../common/zod-error-details';

/** Boot-time environment validation for the NestJS API (§10, §15.3). */
export const ApiEnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url('DATABASE_URL must be a valid URL'),
  AUTH_BASE_URL: z
    .url('AUTH_BASE_URL must be a valid URL')
    .refine((value) => !value.endsWith('/'), 'AUTH_BASE_URL must not end with /'),
});
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export class EnvValidationError extends Error {
  constructor(readonly details: ApiErrorDetail[]) {
    super(`Invalid API environment:\n${formatEnvValidationDetails(details)}`);
    this.name = 'EnvValidationError';
  }
}

export function validateEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  const result = ApiEnvSchema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(zodErrorToApiErrorDetails(result.error));
  }

  return result.data;
}

export const env = (): ApiEnv => validateEnv();

export function formatEnvValidationDetails(details: readonly ApiErrorDetail[]): string {
  return details.map((detail) => `- ${detail.path || '<root>'}: ${detail.message}`).join('\n');
}
