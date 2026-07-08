import { z } from 'zod';

/**
 * Boot-time env validation for apps/web server code (§15.3 — same policy as
 * apps/api: fail fast, never run with a broken env). Split in two: the auth
 * instance only needs BETTER_AUTH_*, the BFF proxy also needs API_BASE_URL.
 */
const UrlNoTrailingSlash = z
  .url()
  .refine((value) => !value.endsWith('/'), 'must not end with /');

const AuthEnvSchema = z.object({
  BETTER_AUTH_URL: UrlNoTrailingSlash,
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 chars'),
});

const WebEnvSchema = AuthEnvSchema.extend({
  API_BASE_URL: UrlNoTrailingSlash,
});

export type AuthEnv = z.infer<typeof AuthEnvSchema>;
export type WebEnv = z.infer<typeof WebEnvSchema>;

let cachedAuthEnv: AuthEnv | undefined;
let cachedWebEnv: WebEnv | undefined;

export function getAuthEnv(): AuthEnv {
  cachedAuthEnv ??= parseEnv(AuthEnvSchema);
  return cachedAuthEnv;
}

export function getWebEnv(): WebEnv {
  cachedWebEnv ??= parseEnv(WebEnvSchema);
  return cachedWebEnv;
}

function parseEnv<TSchema extends z.ZodType>(schema: TSchema): z.infer<TSchema> {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid web environment:\n${details}`);
  }

  return result.data;
}
