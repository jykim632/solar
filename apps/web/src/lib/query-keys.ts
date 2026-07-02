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
};
