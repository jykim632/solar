import { DataLimitsCallout, PageHeader } from '@/components/shell/page-header';
import { MarketPanels } from './market-panels';

/**
 * 발전량·가격 대시보드 (§11.2, r32.4의 레이아웃 기반 — solar-742).
 * mart에 실데이터는 있으나 시계열 API(r32.5)가 아직 없어 예시 시계열로
 * 레이아웃만 확정. 지도(choropleth)는 GeoJSON 로컬 번들 후 추가.
 */
export default function MarketPage() {
  return (
    <>
      <PageHeader
        title="발전량·가격 대시보드"
        scopeBadge="공공데이터 · 광역시도 집계"
        description="선택한 지역의 태양광 발전량과 시장 가격 흐름을 함께 봅니다. 개별 발전소가 아닌 한국전력거래소 공공데이터의 지역 단위 집계값입니다."
        status={<span>발전량 기준일 2026-04-30 · 원천 월 단위 갱신(약 2개월 지연) / REC 기준일 2026-07-02</span>}
      />

      <MarketPanels />

      <DataLimitsCallout>
        데이터 한계: 발전량은 한국전력거래소 공공데이터의 광역시도·시간별 집계값으로 개별 발전소
        실측값이 아니며, 원천이 월 단위로 갱신되어 최근 1~2개월 구간은 제공되지 않을 수 있습니다.
        SMP는 하루전 발전계획용 확정가로 실시간 정산가와 다를 수 있습니다. REC 가격은 현물시장
        거래일(화·목) 기준이고 종가는 육지 시장 기준이며 계약시장 가격을 포함하지 않습니다. 출처:
        한국전력거래소.
      </DataLimitsCallout>
    </>
  );
}
