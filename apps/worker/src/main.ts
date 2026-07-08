/* eslint-disable no-console */
import 'reflect-metadata';
import { listDatasourceKeys } from './ingestion/adapters/index.js';

/**
 * Ingestion worker CLI. 스케줄러 없이 1회 수집 실행(§8.2 로컬 규약) —
 * 배포 시 EventBridge Scheduler → Lambda가 같은 handler.ingest를 호출한다.
 */
interface CliArgs {
  datasource: string;
  from?: string;
  to?: string;
}

async function bootstrap(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command !== 'ingest') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const cliArgs = parseIngestArgs(args);
  const { ingest, closeIngestionResources } = await import('./handler.js');
  const { DatasourceDisabledError } = await import('./ingestion/core.js');

  try {
    const result = await ingest(cliArgs);
    const totalIntervals = result.successfulIntervals + result.failedIntervals;

    console.log(
      `[worker] ingestion ${result.status} datasource=${result.datasource} runId=${result.ingestionRunId.toString()} rows=${result.rowCount} intervals=${result.successfulIntervals}/${totalIntervals}`,
    );

    if (result.errorMessage) {
      console.error(result.errorMessage);
    }

    process.exitCode = result.status === 'success' ? 0 : 1;
  } catch (err) {
    // kill switch(datasource.enabled=false)는 오류가 아니라 의도된 skip —
    // run 기록 없이 exit 0 (스케줄 재시도/DLQ 유발 금지).
    if (err instanceof DatasourceDisabledError) {
      console.log(
        `[worker] ingestion skipped (datasource disabled) datasource=${err.datasource}`,
      );
      process.exitCode = 0;
    } else {
      throw err;
    }
  } finally {
    await closeIngestionResources();
  }
}

function parseIngestArgs(args: string[]): CliArgs {
  const parsed: Partial<CliArgs> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    // pnpm run이 넘기는 구분자 '--'는 무시.
    if (!arg || arg === '--') {
      continue;
    }

    if (arg.startsWith('--datasource=')) {
      parsed.datasource = arg.slice('--datasource='.length);
      continue;
    }

    if (arg === '--datasource') {
      parsed.datasource = readNextArg(args, index, '--datasource');
      index += 1;
      continue;
    }

    if (arg.startsWith('--from=')) {
      parsed.from = arg.slice('--from='.length);
      continue;
    }

    if (arg === '--from') {
      parsed.from = readNextArg(args, index, '--from');
      index += 1;
      continue;
    }

    if (arg.startsWith('--to=')) {
      parsed.to = arg.slice('--to='.length);
      continue;
    }

    if (arg === '--to') {
      parsed.to = readNextArg(args, index, '--to');
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.datasource) {
    throw new Error('--datasource is required.');
  }

  return {
    datasource: parsed.datasource,
    from: parsed.from,
    to: parsed.to,
  };
}

function readNextArg(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printUsage(): void {
  console.log(`Usage:
  pnpm --filter @solar/worker ingest -- --datasource=kpx-pv-gen --from=20260430 --to=20260430
  pnpm --filter @solar/worker ingest -- --datasource=kpx-rec --from=20260702

Options:
  --datasource  required. one of: ${listDatasourceKeys().join(', ')}
  --from/--to   KST YYYYMMDD, inclusive. default: yesterday (KST)`);
}

void bootstrap();
