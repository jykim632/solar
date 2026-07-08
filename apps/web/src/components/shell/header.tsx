'use client';

import { Bell, Building2, ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { GlossaryButton } from './glossary-drawer';

/**
 * 헤더 (56px) — 목업 v4 이식. 조직 전환/알림/용어사전은 후속 이슈에서
 * 실동작 연결. 사용자 메뉴는 세션 표시 + 로그아웃만 실동작.
 */
export function Header({ userName }: { userName: string }) {
  async function signOut() {
    await authClient.signOut();
    window.location.assign('/login');
  }

  const initial = userName.trim().charAt(0) || '?';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-surface-1 px-5">
      <Button variant="outline" size="sm" title="조직 (MVP: 단일 조직)">
        <Building2 />
        데모 조직
        <ChevronDown className="text-text-muted" />
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <GlossaryButton />
        <Button variant="ghost" size="icon-sm" title="알림 (준비 중)">
          <Bell className="text-text-secondary" />
        </Button>
        <Button variant="ghost" size="sm" onClick={signOut} title="로그아웃">
          <span
            className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: 'var(--series-1)' }}
          >
            {initial}
          </span>
          <span>{userName}</span>
        </Button>
      </div>
    </header>
  );
}
