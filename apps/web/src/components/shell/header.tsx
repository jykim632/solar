'use client';

import { Bell, Building2, ChevronDown, CircleHelp } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

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
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b px-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        style={{ borderColor: 'var(--border)' }}
        title="조직 (MVP: 단일 조직)"
      >
        <Building2 size={14} strokeWidth={2} />
        데모 조직
        <ChevronDown size={12} strokeWidth={2} />
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          title="용어 사전 (준비 중)"
        >
          <CircleHelp size={14} strokeWidth={2} />
          도움말
        </button>
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
          title="알림 (준비 중)"
        >
          <Bell size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          title="로그아웃"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: 'var(--series-1)' }}
          >
            {initial}
          </span>
          <span>{userName}</span>
        </button>
      </div>
    </header>
  );
}
