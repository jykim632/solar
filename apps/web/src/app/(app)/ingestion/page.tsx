import { DataLimitsCallout, PageHeader } from '@/components/shell/page-header';
import { IngestionPanels } from './ingestion-panels';

/**
 * 수집 관리 (solar-up3, §11.1 'API 수집 상태' 확장). datasource별 kill switch
 * 토글 + 최근 수집 실행 이력 + quality check 요약 + 수동 실행. MVP는 로그인
 * 게이트만 — platform_admin 제한은 PoC 단계(§10.4)에서 PermissionGuard로.
 */
export default function IngestionPage() {
  return (
    <>
      <PageHeader
        title="수집 관리"
        scopeBadge="운영 · 데이터 파이프라인"
        description="공공데이터 수집 파이프라인의 데이터소스별 상태를 관리합니다. 수집을 끄면 스케줄·수동 실행 모두 건너뜁니다."
      />

      <IngestionPanels />

      <DataLimitsCallout>
        수동 실행은 원천 API를 실제 호출하므로 개발계정 트래픽 제한에 유의하세요. 실행 범위는 최대
        7일이며, 미지정 시 어제(KST) 하루를 수집합니다. 수집 끔은 이 서비스의 수집만 막을 뿐 원천
        데이터 제공기관에는 영향이 없습니다.
      </DataLimitsCallout>
    </>
  );
}
