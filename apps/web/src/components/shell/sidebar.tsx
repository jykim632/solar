'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Calculator,
  Database,
  FileText,
  Sun,
  Timer,
  Users,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * 사이드바 (240px) — 목업 v4 이식. '내 발전소'(계획서 §4 외)는 인터뷰 반응
 * 확인 전이라 제외. P1 화면은 배지로 구분하고 준비 전까지 비활성 링크.
 */
type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  badge?: string;
  disabled?: boolean;
};

const NAV_MAIN: NavItem[] = [
  { href: '/supply', label: '전력수급 상황판', icon: Zap },
  { href: '/market', label: '발전량·가격 대시보드', icon: BarChart3 },
  { href: '/simulator', label: '수익 시뮬레이터', icon: Calculator },
];

const NAV_P1: NavItem[] = [
  { href: '/forecast', label: '예측 데모', icon: Timer, badge: 'P1', disabled: true },
  { href: '/reports', label: '월간 리포트', icon: FileText, badge: 'P1', disabled: true },
];

const NAV_ADMIN: NavItem[] = [
  { href: '/ingestion', label: '수집 관리', icon: Database },
  { href: '/org', label: '조직 관리', icon: Users, disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div
        className="flex h-14 items-center gap-2 border-b px-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <Sun size={20} strokeWidth={2} style={{ color: 'var(--series-1)' }} />
        <span className="text-sm font-semibold">Solar Market Intelligence</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <NavSection items={NAV_MAIN} pathname={pathname} />
        <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />
        <NavSection items={NAV_P1} pathname={pathname} />
        <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />
        <NavSection items={NAV_ADMIN} pathname={pathname} />
      </nav>

      <div
        className="border-t px-4 py-3 text-[11px]"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        비공개 데모 · 공공데이터 기반
      </div>
    </aside>
  );
}

function NavSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <>
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;

        const content = (
          <>
            <Icon size={16} strokeWidth={2} />
            {item.label}
            {item.badge && (
              <Badge variant="outline" className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </>
        );

        if (item.disabled) {
          return (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 opacity-50"
              title="준비 중"
            >
              {content}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
            style={
              active
                ? {
                    background: 'color-mix(in oklab, var(--series-1) 12%, transparent)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                  }
                : undefined
            }
          >
            {content}
          </Link>
        );
      })}
    </>
  );
}
