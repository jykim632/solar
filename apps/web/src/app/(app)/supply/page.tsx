import { DataLimitsCallout, PageHeader } from '@/components/shell/page-header';
import { SupplyDashboard } from './supply-panels';

/**
 * 전력수급 상황판 (§11.1, solar-r32.3).
 * mart_supply_realtime 실데이터 연결 — 한국전력거래소 현재전력수급현황
 * 5분 슬롯(수집 15분 주기 예정).
 */
export default function SupplyPage() {
  return (
    <>
      <PageHeader
        title="전력수급 상황판"
        scopeBadge="전국 계통 기준"
        description="지금 한국 전력계통이 얼마나 여유 있는지 보는 화면입니다. 예비율이 낮을수록 수급이 빠듯하고, 전력 도매가격(SMP)이 오르는 경향이 있습니다."
      />

      <SupplyDashboard />

      <DataLimitsCallout>
        읽는 법: 예비율이 높을수록 계통에 여유가 있다는 뜻입니다. 보통 낮 시간대 태양광 출력이
        커지면 예비율도 함께 오릅니다. 출처: 한국전력거래소 (수집 15분 주기 예정).
      </DataLimitsCallout>
    </>
  );
}
