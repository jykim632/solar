import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

/** 화면 상단 공통 골격 — 제목 + 범위 배지 + 설명 + 우측 상태 라인 (목업 v4). */
export function PageHeader({
  title,
  scopeBadge,
  description,
  status,
}: {
  title: string;
  scopeBadge: string;
  description: string;
  status?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold">{title}</h1>
          <Badge
            variant="outline"
            className="text-text-secondary"
            style={{ background: 'color-mix(in oklab, var(--series-1) 7%, transparent)' }}
          >
            {scopeBadge}
          </Badge>
        </div>
        <p className="mt-1 max-w-xl text-sm text-text-secondary">{description}</p>
      </div>
      {status && (
        <div className="flex items-center gap-3 text-xs text-text-muted">{status}</div>
      )}
    </div>
  );
}

/** 데이터 한계 안내 카드 (목업 v4 — 모든 데이터 화면 하단 공통). */
export function DataLimitsCallout({ children }: { children: ReactNode }) {
  return (
    <div
      className="card px-4 py-3 text-xs leading-relaxed"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </div>
  );
}
