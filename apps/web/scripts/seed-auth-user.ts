/**
 * Seed 계정 생성 (solar-8wv.11). Better Auth의 scrypt 해시/계정 연결 로직을
 * 재사용하기 위해 auth.api.signUpEmail을 호출한다 — 직접 DB insert 금지.
 * 런타임 인스턴스는 disableSignUp: true라서(1.6.0은 서버 호출도 차단) seed
 * 전용 인스턴스를 disableSignUp: false로 따로 만든다.
 *
 * Admin 작업이므로 DATABASE_DIRECT_URL로 접속한다(@solar/db import 전에
 * DATABASE_URL을 덮어써서 pooled 대신 direct를 쓰게 만든다).
 *
 * 실행:
 *   SEED_AUTH_EMAIL=demo@example.com SEED_AUTH_PASSWORD='...' \
 *     pnpm --filter @solar/web seed:auth-user
 */
async function main(): Promise<void> {
  const directUrl = requireEnv('DATABASE_DIRECT_URL');
  process.env.DATABASE_URL = directUrl;
  requireEnv('BETTER_AUTH_URL');
  requireEnv('BETTER_AUTH_SECRET');

  const email = requireEnv('SEED_AUTH_EMAIL').toLowerCase();
  const password = requireEnv('SEED_AUTH_PASSWORD');
  const name = process.env.SEED_AUTH_NAME?.trim() || 'Solar Demo User';

  const { db, pool } = await import('@solar/db');
  const { createSolarAuth } = await import('../src/lib/auth-options');

  try {
    const auth = createSolarAuth({
      database: db,
      disableSignUp: false,
      autoSignIn: false,
    });

    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    // eslint-disable-next-line no-console
    console.log(`[seed:auth] created ${result.user.email} (${result.user.id}).`);
  } catch (error) {
    if (isDuplicateUserError(error)) {
      // eslint-disable-next-line no-console
      console.log(`[seed:auth] ${email} already exists.`);
      return;
    }

    throw error;
  } finally {
    await pool.end();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function isDuplicateUserError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const body = error.body;
  return isRecord(body) && body.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
