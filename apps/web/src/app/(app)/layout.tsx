import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { QueryProvider } from '@/lib/query-provider';
import { getServerSession } from '@/lib/server-session';

/**
 * 단일 로그인 게이트 (solar-8wv.11) + app shell (목업 v4, solar-742).
 * 1차 방어선(UX)일 뿐 — 실제 데이터 접근 권한은 NestJS에서 재검사한다(§10.3).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <QueryProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header userName={session.user.name} />
          <main className="flex-1 space-y-5 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
