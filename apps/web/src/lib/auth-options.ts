import { betterAuth } from 'better-auth';
import { drizzleAdapter, type DB } from 'better-auth/adapters/drizzle';
import { jwt } from 'better-auth/plugins/jwt';
import { organization } from 'better-auth/plugins/organization';
import * as dbSchema from '@solar/db/schema';
import { getAuthEnv } from './env';

/**
 * Better Auth instance factory (§10.3). Shared by the runtime instance
 * (disableSignUp: true — invite-only, no public signup) and the seed script
 * (disableSignUp: false — 1.6.0 enforces disableSignUp even for server-side
 * auth.api.signUpEmail, so seeding needs its own instance).
 *
 * Better Auth model ids → auth_* prefixed Drizzle tables (solar-8wv.9:
 * drizzle-kit owns all migrations; the Better Auth CLI is not used).
 */
export const betterAuthDrizzleSchema = {
  user: dbSchema.authUser,
  session: dbSchema.authSession,
  account: dbSchema.authAccount,
  verification: dbSchema.authVerification,
  organization: dbSchema.authOrganization,
  member: dbSchema.authMember,
  invitation: dbSchema.authInvitation,
  jwks: dbSchema.authJwks,
} as const;

export type CreateSolarAuthOptions = {
  database: DB;
  disableSignUp: boolean;
  autoSignIn?: boolean;
};

export function createSolarAuth({
  database,
  disableSignUp,
  autoSignIn = true,
}: CreateSolarAuthOptions) {
  const authEnv = getAuthEnv();

  return betterAuth({
    appName: 'Solar Market Intelligence',
    baseURL: authEnv.BETTER_AUTH_URL,
    secret: authEnv.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: betterAuthDrizzleSchema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp,
      autoSignIn,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    plugins: [
      organization(),
      jwt({
        jwks: {
          // EdDSA/Ed25519 (§10.3 비대칭 + JWKS). 1.6.0 default이지만 명시 고정.
          keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
        },
        jwt: {
          issuer: authEnv.BETTER_AUTH_URL,
          audience: authEnv.BETTER_AUTH_URL,
          // §10.3: 5~10분 TTL. role/membership claim 금지 — 권한은 매 요청 DB 조회.
          expirationTime: '5m',
          definePayload: ({ user }) => ({ email: user.email }),
          getSubject: ({ user }) => user.id,
        },
      }),
    ],
  });
}
