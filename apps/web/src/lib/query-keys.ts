export const DEMO_ORGANIZATION_ID = 'demo-org-week-1-spike';

const organization = (organizationId: string) => ['organization', organizationId] as const;

/**
 * 테넌트 scoped react-query key 규약 (§7.2/§18.2): organizationId를 1급
 * 세그먼트로 맨 앞에 둔다. 조직 전환 시 queryClient.clear()로 캐시 누출 차단.
 */
export const queryKeys = {
  organization,
  spikeHourlyGeneration: (organizationId: string) =>
    [...organization(organizationId), 'spike', 'hourly-generation'] as const,
  // /market 대시보드 (solar-r32.4). 발전량 데이터가 ~2개월 지연이라 최신
  // source_date를 먼저 조회(latest)해 모든 윈도우의 앵커로 쓴다.
  generationLatest: (organizationId: string) =>
    [...organization(organizationId), 'generation', 'latest'] as const,
  // region/from/to를 key에 담아 지역·기간 변경 시 자동 refetch.
  generationDaily: (organizationId: string, region: string, from: string, to: string) =>
    [...organization(organizationId), 'generation', 'daily', region, from, to] as const,
  // 최신일 지역별 스냅샷(지도). date는 latestAvailableSourceDate.
  generationMapDaily: (organizationId: string, date: string) =>
    [...organization(organizationId), 'generation', 'map-daily', date] as const,
  // REC는 서버 기본 90일 창을 한 번 받고 기간 필터는 클라이언트에서 — area만 key에.
  recDaily: (organizationId: string, area: string) =>
    [...organization(organizationId), 'rec', 'daily', area] as const,
  // SMP 시간별 (solar-r32.7). 하루전 예측 소스 — 서버 기본 7일 창, area만 key에.
  smpHourly: (organizationId: string, area: string) =>
    [...organization(organizationId), 'smp', 'hourly', area] as const,
  // 전력수급 상황판 (solar-r32.3). 실시간 5분 슬롯이라 지연 없음 — hours 창만 key에.
  supplyRealtime: (organizationId: string, hours: number) =>
    [...organization(organizationId), 'supply', 'realtime', hours] as const,
  // 수집 관리 (solar-up3). datasource 목록+최근 run 요약 / 실행 이력(필터 datasource key).
  opsDatasources: (organizationId: string) =>
    [...organization(organizationId), 'ops', 'datasources'] as const,
  opsRuns: (organizationId: string, datasource: string) =>
    [...organization(organizationId), 'ops', 'runs', datasource] as const,
};
