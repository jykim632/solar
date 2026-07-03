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
  {
    name: 'kma-vilage-fcst',
    provider: 'KMA',
    sourceType: 'openapi',
    updateCycle: 'daily',
    url: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
    license: '공공데이터포털 이용허락범위 제한 없음',
    note: '기상청 단기예보 getVilageFcst. base_time=0500 KST 고정, 시도 대표 nx/ny 17개 루프.',
  },
  {
    name: 'kma-solar-irradiance',
    provider: 'KMA-APIHUB',
    sourceType: 'openapi-text',
    updateCycle: 'daily',
    url: 'https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph_sun_sat_ana_txt',
    license: '기상청 API허브 이용조건 확인 필요',
    note: '위성 AI 일사량 AI-DSR, UTC 30분 슬롯, 요청당 최대 24슬롯(하루 2분할). ymd=UTC 일자.',
  },
];
