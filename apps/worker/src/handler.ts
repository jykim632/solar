import { db, pool } from '@solar/db';
import { getAdapter } from './ingestion/adapters/index.js';
import {
  createRawStoreFromEnv,
  resolveRequestedDateRange,
  runIngestion,
  type IngestionSummary,
} from './ingestion/core.js';

/**
 * 수집 1회 실행 handler. CLI(main.ts)와 향후 Lambda(EventBridge Scheduler
 * event)가 공유한다 — event shape을 Lambda payload와 동일하게 유지할 것.
 */
export interface IngestEvent {
  datasource: string;
  from?: string;
  to?: string;
}

export async function ingest(event: IngestEvent): Promise<IngestionSummary> {
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    throw new Error('DATA_GO_KR_API_KEY is required.');
  }

  const adapter = getAdapter(event.datasource);
  const dateRange = resolveRequestedDateRange({ from: event.from, to: event.to });
  const rawStore = createRawStoreFromEnv(process.env);

  return runIngestion({
    db,
    adapter,
    rawStore,
    dateRange,
    apiKey,
  });
}

export async function closeIngestionResources(): Promise<void> {
  await pool.end();
}
