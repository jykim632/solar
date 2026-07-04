'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiClientError, bffFetch } from '@/lib/bff-client';

/**
 * Walking skeleton proof (solar-8wv.12): 브라우저 → /api/bff/me → NestJS
 * /api/v1/me. 성공하면 JWT 검증까지 통과한 claims가 표시된다.
 */
const MeResponseSchema = z.object({
  sub: z.string(),
  email: z.string(),
});

export function MeProbe() {
  const meQuery = useQuery({
    queryKey: ['debug', 'me'],
    queryFn: () => bffFetch('/api/bff/me', MeResponseSchema),
    retry: false,
  });

  async function signOut() {
    await authClient.signOut();
    window.location.assign('/login');
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between gap-4">
        <h2 className="m-0 text-base font-semibold">보호 API 호출 결과 (/api/v1/me)</h2>
        <Button variant="outline" size="sm" onClick={signOut}>
          로그아웃
        </Button>
      </div>

      {meQuery.isPending && <p>불러오는 중...</p>}

      {meQuery.isError && (
        <p className="text-delta-bad">BFF 호출 실패: {formatError(meQuery.error)}</p>
      )}

      {meQuery.isSuccess && (
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-2">
          <dt className="text-text-secondary">sub</dt>
          <dd className="m-0 font-mono">{meQuery.data.sub}</dd>
          <dt className="text-text-secondary">email</dt>
          <dd className="m-0 font-mono">{meQuery.data.email}</dd>
        </dl>
      )}
    </Card>
  );
}

function formatError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return `${error.error.message} (${error.error.code})`;
  }

  return error instanceof Error ? error.message : 'Failed to load protected API.';
}
