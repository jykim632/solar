'use client';

import { type FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Open-redirect 방지: 같은 origin의 절대경로만 허용.
  const rawCallbackURL = searchParams.get('callbackURL');
  const callbackURL =
    rawCallbackURL?.startsWith('/') && !rawCallbackURL.startsWith('//') ? rawCallbackURL : '/';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    const { error: signInError } = await authClient.signIn.email({ email, password });

    if (signInError) {
      setPending(false);
      setError(signInError.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    router.replace(callbackURL);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          style={{ height: 38, padding: '0 10px' }}
        />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          style={{ height: 38, padding: '0 10px' }}
        />
      </label>

      {error && <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}

      <button type="submit" disabled={pending} style={{ height: 40 }}>
        {pending ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
