/**
 * @solar/worker 패키지 표면 — API의 수동 실행(POST /ops/ingestions)이 in-process로
 * 사용하는 것만 노출한다(solar-up3). main.ts는 CLI 부수효과(bootstrap 실행)가
 * 있으므로 여기서 절대 재export하지 않는다.
 *
 * closeIngestionResources는 의도적으로 제외 — @solar/db의 pg pool은 pnpm
 * workspace 싱글턴이라 API가 닫으면 API 자신의 DB 연결도 끊긴다.
 */
export { ingest, type IngestEvent } from './handler.js';
export { getAdapter, listDatasourceKeys } from './ingestion/adapters/index.js';
export {
  DatasourceDisabledError,
  resolveRequestedDateRange,
  type DatasourceKey,
  type IngestionRunStatus,
  type IngestionSummary,
  type RequestedDateRange,
} from './ingestion/core.js';
