import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { Db } from '@solar/db';
import {
  datasource,
  opsDataQualityCheck,
  opsIngestionRun,
  rawObject,
  region,
} from '@solar/db/schema';
import { DATA_GO_KR_OK, DataGoKrEnvelopeSchema } from '@solar/ingestion-schemas';

/**
 * Ingestion pipeline core (§8, solar-2af.1).
 *
 * Datasource Adapter → Raw Store → (Zod envelope) → Staging Transform →
 * Quality Check → Mart Upsert, all recorded in ops_ingestion_run.
 *
 * 스케줄링은 EventBridge Scheduler(§1.3)가 담당한다 — 이 모듈은 "1회 수집
 * 실행"만 안다. 로컬에선 CLI(main.ts), 배포에선 Lambda handler(handler.ts)가
 * 같은 runIngestion을 호출한다. Redis/BullMQ 없음(사용자 override).
 *
 * 멱등성 2중 보장(§8.2): raw_object는 (datasource_id, content_hash) UNIQUE +
 * onConflictDoNothing, mart는 natural key onConflictDoUpdate upsert.
 */
export type DatasourceKey = 'kpx-pv-gen' | 'kpx-rec';
export type IngestionRunStatus = 'running' | 'success' | 'failed' | 'partial';
export type DataQualityStatus = 'pass' | 'warn' | 'fail';

export interface DataQualityCheckResult {
  checkName: string;
  status: DataQualityStatus;
  details?: Record<string, unknown>;
}

export interface TransformIssue {
  code: string;
  severity: 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

export interface TransformContext {
  datasourceId: number;
  ingestionRunId: bigint;
  ymd: string;
  regionMap: ReadonlyMap<string, string>;
}

export interface TransformResult {
  rows: unknown[];
  issues: TransformIssue[];
}

export interface QualityCheckInput {
  ymd: string;
  rawRows: unknown[];
  martRows: unknown[];
  issues: TransformIssue[];
}

export interface AdapterRequestInput {
  apiKey: string;
  ymd: string;
  pageNo: number;
  numOfRows: number;
}

export interface DataGoKrAdapter {
  key: DatasourceKey;
  datasourceName: string;
  provider: string;
  defaultNumOfRows: number;
  buildUrl(input: AdapterRequestInput): string;
  parseRows(items: unknown[]): unknown[];
  transformRows(rows: unknown[], context: TransformContext): TransformResult;
  qualityChecks(input: QualityCheckInput): DataQualityCheckResult[];
  upsertMart(db: Db, rows: unknown[]): Promise<number>;
}

export interface RequestedDateRange {
  fromYmd: string;
  toYmd: string;
  ymds: string[];
  requestedFrom: Date;
  requestedTo: Date;
}

export interface RunIngestionInput {
  db: Db;
  adapter: DataGoKrAdapter;
  rawStore: RawStore;
  dateRange: RequestedDateRange;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface IngestionSummary {
  ingestionRunId: bigint;
  datasource: DatasourceKey;
  status: Exclude<IngestionRunStatus, 'running'>;
  requestedFrom: Date;
  requestedTo: Date;
  rowCount: number;
  successfulIntervals: number;
  failedIntervals: number;
  errorMessage?: string;
}

export interface RawStoreSaveInput {
  datasourceName: string;
  logicalDate: string;
  pageNo: number;
  contentHash: string;
  body: string;
  contentType?: string;
}

export interface RawStoreSaveResult {
  objectPath: string;
}

export interface RawStore {
  save(input: RawStoreSaveInput): Promise<RawStoreSaveResult>;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const YMD_RE = /^\d{8}$/;

export const UNKNOWN_REGION_CODE = 'UNKNOWN';

export function parseYmd(
  ymd: string,
  fieldName = 'date',
): { year: number; month: number; day: number } {
  if (!YMD_RE.test(ymd)) {
    throw new Error(`${fieldName} must be YYYYMMDD.`);
  }

  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const day = Number(ymd.slice(6, 8));
  const normalized = new Date(Date.UTC(year, month - 1, day));

  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} is not a valid calendar date.`);
  }

  return { year, month, day };
}

export function ymdToDateLiteral(ymd: string): string {
  parseYmd(ymd);
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/** KST 자정(해당 날짜 00:00 KST)의 UTC 시각. */
export function ymdToKstStartUtcDate(ymd: string): Date {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
}

/** KST 날짜+시(0..23)의 UTC 시각. */
export function kstDateHourToUtcDate(ymd: string, hour: number): Date {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('hour must be 0..23.');
  }
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, 0, 0, 0));
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDaysToYmd(ymd: string, days: number): string {
  const parsed = parseYmd(ymd);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export function toKstYmd(date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10).replaceAll('-', '');
}

export function enumerateYmdRange(fromYmd: string, toYmd: string): string[] {
  parseYmd(fromYmd, '--from');
  parseYmd(toYmd, '--to');

  if (fromYmd > toYmd) {
    throw new Error('--from must be earlier than or equal to --to.');
  }

  const dates: string[] = [];
  let current = fromYmd;

  while (current <= toYmd) {
    dates.push(current);
    current = addDaysToYmd(current, 1);
  }

  return dates;
}

/**
 * --from/--to는 KST YYYYMMDD **양끝 포함**. ops_ingestion_run에는
 * requested_from = from 00:00 KST, requested_to = (to+1일) 00:00 KST(배타)로
 * 기록한다. 둘 다 생략하면 어제(KST) 하루.
 */
export function resolveRequestedDateRange(
  input: { from?: string; to?: string },
  now = new Date(),
): RequestedDateRange {
  const defaultYmd = addDaysToYmd(toKstYmd(now), -1);
  const fromYmd = input.from ?? input.to ?? defaultYmd;
  const toYmd = input.to ?? input.from ?? defaultYmd;
  const ymds = enumerateYmdRange(fromYmd, toYmd);

  return {
    fromYmd,
    toYmd,
    ymds,
    requestedFrom: ymdToKstStartUtcDate(fromYmd),
    requestedTo: ymdToKstStartUtcDate(addDaysToYmd(toYmd, 1)),
  };
}

/** 기본 raw store: data/raw/<datasource>/<YYYYMMDD>/page-*.json (gitignored). */
export class LocalFsRawStore implements RawStore {
  private readonly rootDir: string;

  constructor(rootDir = path.join(findWorkspaceRoot(), 'data', 'raw')) {
    this.rootDir = rootDir;
  }

  async save(input: RawStoreSaveInput): Promise<RawStoreSaveResult> {
    const datasourceSegment = sanitizePathSegment(input.datasourceName);
    const fileName = `page-${String(input.pageNo).padStart(4, '0')}-${input.contentHash}.json`;
    const dir = path.join(this.rootDir, datasourceSegment, input.logicalDate);
    const filePath = path.join(dir, fileName);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, input.body);

    return {
      objectPath: path.posix.join('data/raw', datasourceSegment, input.logicalDate, fileName),
    };
  }
}

/** S3 raw store — 구현은 solar-lfp(AWS 셋업)에서. 지금은 fail-fast stub. */
export class S3RawStore implements RawStore {
  constructor(private readonly bucket: string) {
    if (!bucket) {
      throw new Error('RAW_STORE_S3_BUCKET is required when RAW_STORE=s3.');
    }
  }

  async save(input: RawStoreSaveInput): Promise<RawStoreSaveResult> {
    const key = path.posix.join(
      input.datasourceName,
      input.logicalDate,
      `page-${String(input.pageNo).padStart(4, '0')}-${input.contentHash}.json`,
    );

    throw new Error(
      `S3RawStore is not implemented yet (solar-lfp). Intended bucket=${this.bucket}, key=${key}.`,
    );
  }
}

export function createRawStoreFromEnv(env: NodeJS.ProcessEnv = process.env): RawStore {
  const mode = env.RAW_STORE ?? 'local';

  if (mode === 'local') {
    return new LocalFsRawStore();
  }

  if (mode === 's3') {
    return new S3RawStore(env.RAW_STORE_S3_BUCKET ?? '');
  }

  throw new Error(`Unsupported RAW_STORE "${mode}". Expected "local" or "s3".`);
}

/** region.kpx_region_name → region_code 역방향 매핑 (검증된 문자열, §9.2). */
export async function loadKpxRegionMap(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({
      regionCode: region.regionCode,
      kpxRegionName: region.kpxRegionName,
    })
    .from(region);

  const map = new Map<string, string>();

  for (const row of rows) {
    if (row.kpxRegionName) {
      map.set(row.kpxRegionName, row.regionCode);
    }
  }

  return map;
}

export async function runIngestion(input: RunIngestionInput): Promise<IngestionSummary> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const datasourceId = await findDatasourceId(input.db, input.adapter);
  const regionMap = await loadKpxRegionMap(input.db);

  const [runRow] = await input.db
    .insert(opsIngestionRun)
    .values({
      datasourceId,
      status: 'running',
      requestedFrom: input.dateRange.requestedFrom,
      requestedTo: input.dateRange.requestedTo,
      rowCount: 0,
    })
    .returning({ id: opsIngestionRun.id });

  if (!runRow) {
    throw new Error('Failed to create ops_ingestion_run row.');
  }

  let rowCount = 0;
  let successfulIntervals = 0;
  let failedIntervals = 0;
  const errors: string[] = [];

  for (const ymd of input.dateRange.ymds) {
    try {
      const result = await ingestOneInterval({
        db: input.db,
        adapter: input.adapter,
        rawStore: input.rawStore,
        apiKey: input.apiKey,
        datasourceId,
        ingestionRunId: runRow.id,
        ymd,
        regionMap,
        fetchImpl,
      });

      if (result.ok) {
        successfulIntervals += 1;
        rowCount += result.rowCount;
      } else {
        failedIntervals += 1;
        errors.push(result.errorMessage);
      }
    } catch (err) {
      failedIntervals += 1;
      const message = errorToMessage(err);
      errors.push(`${ymd}: ${message}`);
      await insertQualityChecks(input.db, runRow.id, [
        {
          checkName: 'interval_ingest',
          status: 'fail',
          details: { ymd, error: message },
        },
      ]);
    }
  }

  // partial = 일부 interval만 성공(§8.2). quality 'warn'은 성공으로 취급,
  // 'fail'은 해당 interval 실패로 집계된다.
  const status: Exclude<IngestionRunStatus, 'running'> =
    failedIntervals === 0 ? 'success' : successfulIntervals > 0 ? 'partial' : 'failed';

  const errorMessage = errors.length > 0 ? truncate(errors.join('\n'), 4000) : undefined;

  await input.db
    .update(opsIngestionRun)
    .set({
      finishedAt: new Date(),
      status,
      rowCount,
      errorMessage: errorMessage ?? null,
    })
    .where(eq(opsIngestionRun.id, runRow.id));

  return {
    ingestionRunId: runRow.id,
    datasource: input.adapter.key,
    status,
    requestedFrom: input.dateRange.requestedFrom,
    requestedTo: input.dateRange.requestedTo,
    rowCount,
    successfulIntervals,
    failedIntervals,
    errorMessage,
  };
}

async function ingestOneInterval(input: {
  db: Db;
  adapter: DataGoKrAdapter;
  rawStore: RawStore;
  apiKey: string;
  datasourceId: number;
  ingestionRunId: bigint;
  ymd: string;
  regionMap: ReadonlyMap<string, string>;
  fetchImpl: typeof fetch;
}): Promise<{ ok: true; rowCount: number } | { ok: false; errorMessage: string }> {
  const rawRows: unknown[] = [];
  let pageNo = 1;

  while (true) {
    const url = input.adapter.buildUrl({
      apiKey: input.apiKey,
      ymd: input.ymd,
      pageNo,
      numOfRows: input.adapter.defaultNumOfRows,
    });

    const response = await input.fetchImpl(url, {
      headers: { 'user-agent': 'solar-worker/0.1' },
    });
    const bodyText = await response.text();
    const contentHash = sha256(bodyText);
    const contentType = response.headers.get('content-type') ?? undefined;

    // 원본은 검증 전에 항상 저장한다 (§8.2 — 에러 응답도 raw로 남긴다).
    const saved = await input.rawStore.save({
      datasourceName: input.adapter.datasourceName,
      logicalDate: input.ymd,
      pageNo,
      contentHash,
      body: bodyText,
      contentType,
    });

    await recordRawObject(input.db, {
      datasourceId: input.datasourceId,
      ingestionRunId: input.ingestionRunId,
      objectPath: saved.objectPath,
      contentType,
      contentHash,
      sourceUrl: redactServiceKey(url),
      fetchedAt: new Date(),
      metadata: {
        ymd: input.ymd,
        pageNo,
        httpStatus: response.status,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from datasource.`);
    }

    let json: unknown;
    try {
      json = JSON.parse(bodyText);
    } catch {
      throw new Error('Response was saved but is not valid JSON.');
    }

    const envelopeResult = DataGoKrEnvelopeSchema.safeParse(json);
    if (!envelopeResult.success) {
      throw new Error(`DataGoKr envelope validation failed: ${envelopeResult.error.message}`);
    }

    const envelope = envelopeResult.data;
    if (envelope.response.header.resultCode !== DATA_GO_KR_OK) {
      throw new Error(
        `DataGoKr resultCode=${envelope.response.header.resultCode}: ${envelope.response.header.resultMsg}`,
      );
    }

    const body = envelope.response.body;
    const items = body?.items?.item ?? [];
    const parsedRows = input.adapter.parseRows(items);
    rawRows.push(...parsedRows);

    const totalCount = body?.totalCount ?? rawRows.length;
    const numOfRows = body?.numOfRows ?? input.adapter.defaultNumOfRows;

    if (totalCount === 0 || items.length === 0 || rawRows.length >= totalCount) {
      break;
    }

    pageNo += 1;

    // 방어: totalCount가 흔들려도 무한 페이지 루프 금지.
    if (pageNo > Math.ceil(totalCount / Math.max(numOfRows, 1)) + 1) {
      break;
    }
  }

  const transformed = input.adapter.transformRows(rawRows, {
    datasourceId: input.datasourceId,
    ingestionRunId: input.ingestionRunId,
    ymd: input.ymd,
    regionMap: input.regionMap,
  });

  const checks = input.adapter.qualityChecks({
    ymd: input.ymd,
    rawRows,
    martRows: transformed.rows,
    issues: transformed.issues,
  });

  await insertQualityChecks(input.db, input.ingestionRunId, checks);

  const failChecks = checks.filter((check) => check.status === 'fail');
  if (failChecks.length > 0) {
    return {
      ok: false,
      errorMessage: `${input.ymd}: quality checks failed (${failChecks
        .map((c) => c.checkName)
        .join(', ')})`,
    };
  }

  const rowCount = await input.adapter.upsertMart(input.db, transformed.rows);
  return { ok: true, rowCount };
}

async function findDatasourceId(db: Db, adapter: DataGoKrAdapter): Promise<number> {
  const rows = await db
    .select({ id: datasource.id })
    .from(datasource)
    .where(
      and(eq(datasource.name, adapter.datasourceName), eq(datasource.provider, adapter.provider)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(
      `Datasource seed is missing for name=${adapter.datasourceName}, provider=${adapter.provider}. Run pnpm db:seed.`,
    );
  }

  return row.id;
}

async function insertQualityChecks(
  db: Db,
  ingestionRunId: bigint,
  checks: DataQualityCheckResult[],
): Promise<void> {
  if (checks.length === 0) {
    return;
  }

  await db.insert(opsDataQualityCheck).values(
    checks.map((check) => ({
      ingestionRunId,
      checkName: check.checkName,
      status: check.status,
      details: check.details ?? {},
    })),
  );
}

async function recordRawObject(
  db: Db,
  input: {
    datasourceId: number;
    ingestionRunId: bigint;
    objectPath: string;
    contentType?: string;
    contentHash: string;
    sourceUrl: string;
    fetchedAt: Date;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .insert(rawObject)
    .values({
      datasourceId: input.datasourceId,
      ingestionRunId: input.ingestionRunId,
      objectPath: input.objectPath,
      contentType: input.contentType ?? null,
      contentHash: input.contentHash,
      sourceUrl: input.sourceUrl,
      fetchedAt: input.fetchedAt,
      metadata: input.metadata,
    })
    .onConflictDoNothing({ target: [rawObject.datasourceId, rawObject.contentHash] });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function redactServiceKey(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('serviceKey', 'REDACTED');
  return parsed.toString();
}

function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : 'datasource';
}

function findWorkspaceRoot(startDir = process.cwd()): string {
  let dir = startDir;

  while (true) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return startDir;
    }

    dir = parent;
  }
}

function errorToMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
