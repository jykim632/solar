import 'reflect-metadata';

/**
 * Ingestion worker entrypoint (NestJS standalone). BullMQ repeatable jobs
 * (jobId=datasource:interval, at-least-once + idempotent upsert) are wired
 * in solar-2af.2. This bootstrap only proves the process starts.
 */
async function bootstrap(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[worker] started (no ingestion jobs registered yet — see solar-2af).');
}

void bootstrap();
