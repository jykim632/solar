import { DataLimitsCallout, PageHeader } from '@/components/shell/page-header';
import { SupplyKpiCards, SupplyCharts } from './supply-panels';

/**
 * 전력수급 상황판 (§11.1, r32.3의 레이아웃 기반 — solar-742).
 * 데이터 소스(수급현황 API)가 승인 대기 중이라 현재는 '수집 대기' 상태 +
 * 더미 시계열. 실데이터 연결은 solar-r32.3에서.
 */
export default function SupplyPage() {
  return (
    <>
      <PageHeader
        title="전력수급 상황판"
        scopeBadge="전국 계통 기준"
        description="지금 한국 전력계통이 얼마나 여유 있는지 보는 화면입니다. 예비율이 낮을수록 수급이 빠듯하고, 전력 도매가격(SMP)이 오르는 경향이 있습니다."
        status={
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: 'var(--status-warning)' }}
            />
            데이터 소스 승인 대기 중 — 아래는 레이아웃 확인용 예시 데이터
          </span>
        }
      />

      <SupplyKpiCards />
      <SupplyCharts />

      <DataLimitsCallout>
        읽는 법: 예비율이 높을수록 계통에 여유가 있다는 뜻입니다. 보통 낮 시간대 태양광 출력이
        커지면 예비율도 함께 오릅니다. 출처: 한국전력거래소 (수집 15분 주기 예정).
      </DataLimitsCallout>
    </>
  );
}
