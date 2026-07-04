import { DataLimitsCallout } from '@/components/shell/page-header';
import { SupplyDashboard } from './supply-panels';

/**
 * 전력수급 상황판 (§11.1, solar-r32.3).
 * mart_supply_realtime 실데이터 연결 — 한국전력거래소 현재전력수급현황
 * 5분 슬롯(수집 15분 주기 예정). 데이터 기준시각은 헤더에 표시하기 위해
 * PageHeader를 client 컴포넌트(SupplyDashboard) 안에서 렌더한다.
 */
export default function SupplyPage() {
  return (
    <>
      <SupplyDashboard />

      <DataLimitsCallout>
        읽는 법: 예비율이 높을수록 계통에 여유가 있다는 뜻입니다. 보통 낮 시간대 태양광 출력이
        커지면 예비율도 함께 오릅니다. 출처: 한국전력거래소 (수집 15분 주기 예정).
      </DataLimitsCallout>
    </>
  );
}
