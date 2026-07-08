import { db, pool } from '@solar/db';
import { getAdapter } from './ingestion/adapters/index.js';
import {
  createRawStoreFromEnv,
  resolveRequestedDateRange,
  runIngestion,
  type ApiKeyName,
  type IngestionApiKeys,
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
  const adapter = getAdapter(event.datasource);
  const apiKeys = loadApiKeys(adapter.requiredApiKeys, process.env);
  const dateRange = resolveRequestedDateRange(
    { from: event.from, to: event.to },
    new Date(),
    adapter.dateRangeMode ?? 'kst-day',
  );
  const rawStore = createRawStoreFromEnv(process.env);

  return runIngestion({
    db,
    adapter,
    rawStore,
    dateRange,
    apiKeys,
  });
}

function loadApiKeys(required: readonly ApiKeyName[], env: NodeJS.ProcessEnv): IngestionApiKeys {
  const out: IngestionApiKeys = {};

  for (const key of required) {
    if (key === 'dataGoKr') {
      if (!env.DATA_GO_KR_API_KEY) {
        throw new Error('DATA_GO_KR_API_KEY is required.');
      }
      out.dataGoKr = env.DATA_GO_KR_API_KEY;
    } else {
      if (!env.KMA_API_KEY) {
        throw new Error('KMA_API_KEY is required.');
      }
      out.kmaApiHub = env.KMA_API_KEY;
    }
  }

  return out;
}

export async function closeIngestionResources(): Promise<void> {
  await pool.end();
}
