'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

/**
 * Walking skeleton proof (solar-8wv.12): 브라우저 → /api/bff/me → NestJS
 * /api/v1/me. 성공하면 JWT 검증까지 통과한 claims가 표시된다.
 */
type MeResponse = {
  sub: string;
  email: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: MeResponse }
  | { status: 'error'; message: string };

export function MeProbe() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const response = await fetch('/api/bff/me', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });
        const body: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(errorMessage(body, response.status));
        }

        if (!isMeResponse(body)) {
          throw new Error('Unexpected /api/bff/me response shape.');
        }

        if (active) {
          setState({ status: 'ready', data: body });
        }
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load protected API.',
          });
        }
      }
    }

    void loadMe();

    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    window.location.assign('/login');
  }

  return (
    <section style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>보호 API 호출 결과 (/api/v1/me)</h2>
        <button type="button" onClick={signOut} disabled={signingOut}>
          {signingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>

      {state.status === 'loading' && <p>불러오는 중...</p>}

      {state.status === 'error' && (
        <p style={{ color: '#b91c1c' }}>BFF 호출 실패: {state.message}</p>
      )}

      {state.status === 'ready' && (
        <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
          <dt>sub</dt>
          <dd style={{ margin: 0, fontFamily: 'monospace' }}>{state.data.sub}</dd>
          <dt>email</dt>
          <dd style={{ margin: 0, fontFamily: 'monospace' }}>{state.data.email}</dd>
        </dl>
      )}
    </section>
  );
}

function isMeResponse(value: unknown): value is MeResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sub' in value &&
    'email' in value &&
    typeof value.sub === 'string' &&
    typeof value.email === 'string'
  );
}

function errorMessage(body: unknown, status: number): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }

  return `HTTP ${status}`;
}
