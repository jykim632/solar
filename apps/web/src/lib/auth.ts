import { db } from '@solar/db';
import { createSolarAuth } from './auth-options';

/**
 * Runtime Better Auth instance. Server-only — never import from client
 * components. Public signup stays disabled (invite-only MVP, §3.1/§10.3).
 */
export const auth = createSolarAuth({
  database: db,
  disableSignUp: true,
});

export type AuthSession = typeof auth.$Infer.Session;
