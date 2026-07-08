import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SimulatorPanels } from './simulator-panels';

/**
 * 수익 시뮬레이터 (§13, cgc.4의 레이아웃 기반 — solar-742).
 * 계산 API(cgc.1)가 아직 없어 폼 + 결과 레이아웃만. form/wire 분리 스키마는
 * 스파이크의 spike-schemas 패턴을 cgc.4에서 본 구현으로 확장.
 */
export default function SimulatorPage() {
  return (
    <>
      <PageHeader
        title="수익 시뮬레이터"
        scopeBadge="가정 기반 시뮬레이션"
        description="내 설비 조건을 입력하면 예상 수익을 계산해 봅니다. 조건을 바꿔가며 여러 시나리오를 비교해 보세요."
      />

      {/* 1순위 면책 (§13) — 화면 최상단 고정 */}
      <div
        className="card flex items-start gap-2.5 px-4 py-3 text-sm"
        style={{ borderColor: 'color-mix(in oklab, var(--status-warning) 50%, transparent)' }}
      >
        <AlertTriangle
          size={16}
          strokeWidth={2}
          className="mt-0.5 shrink-0"
          style={{ color: 'var(--status-warning)' }}
        />
        <p>
          <strong>
            본 추정은 현물시장 노출 가정이며, 고정가격계약 사업자에게는 적용되지 않습니다.
          </strong>{' '}
          실제 정산이 아닌 가정 기반 시뮬레이션입니다.
        </p>
      </div>

      <SimulatorPanels />
    </>
  );
}
