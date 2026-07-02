import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { QueryProvider } from '@/lib/query-provider';
import { getServerSession } from '@/lib/server-session';

/**
 * 단일 로그인 게이트 (solar-8wv.11). (app) 그룹의 모든 route는 세션 필수.
 * 1차 방어선(UX)일 뿐 — 실제 데이터 접근 권한은 NestJS에서 재검사한다(§10.3).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return <QueryProvider>{children}</QueryProvider>;
}
