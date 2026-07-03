import type { datasource } from '../schema/ops';

type DatasourceSeedRow = typeof datasource.$inferInsert;

/**
 * Datasource 등록 (§9.1). name+provider UNIQUE — adapter가 이 이름으로
 * datasource_id를 조회한다 (apps/worker/src/ingestion/adapters/*).
 */
export const datasourceSeedRows: DatasourceSeedRow[] = [
  {
    name: 'kpx-pv-gen',
    provider: 'KPX',
    sourceType: 'openapi',
    updateCycle: 'monthly-batch',
    url: 'https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr',
    license: '공공데이터포털 이용허락범위 제한 없음',
    note: '지역별 시간별 태양광 발전량. tradeNo 1..24, regionNm 17종 검증(2026-07-03). 데이터 lag ~2개월.',
  },
  {
    name: 'kpx-rec',
    provider: 'KPX',
    sourceType: 'openapi',
    updateCycle: 'trading-day',
    url: 'https://apis.data.go.kr/B552115/RecMarketInfo2/getRecMarketInfo2',
    license: '공공데이터포털 이용허락범위 제한 없음',
    note: 'REC 현물시장(화/목 개장). bzDd 필터. clsPrc=육지 기준 종가 관측 → TOTAL row에 저장.',
  },
];
