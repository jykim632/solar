import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  IngestionRunStatus,
  OpsDatasourceItem,
  OpsDatasourceUpdateBody,
  OpsDatasourcesResponse,
  OpsIngestionTriggerBody,
  OpsIngestionTriggerResponse,
  OpsRunItem,
  OpsRunsQuery,
  OpsRunsResponse,
  QualityCounts,
} from '@solar/api-contracts';
import type { Db } from '@solar/db';
import { datasource, opsDataQualityCheck, opsIngestionRun } from '@solar/db/schema';
import {
  DatasourceDisabledError,
  getAdapter,
  ingest,
  resolveRequestedDateRange,
} from '@solar/worker';
import { and, count, desc, eq, gt, inArray } from 'drizzle-orm';
import { DB } from '../db/db.module';

/** 수동 실행 범위 상한 — 동기 실행이라 interval 수를 제한한다(외부 API 일별 호출). */
const MAX_TRIGGER_RANGE_DAYS = 7;
/** 이보다 오래된 'running'은 크래시 잔재로 보고 동시 실행 가드에서 무시. */
const RUNNING_STALE_MINUTES = 30;

type RunRow = {
  id: bigint;
  datasourceId: number;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  requestedFrom: Date | null;
  requestedTo: Date | null;
  rowCount: number | null;
  errorMessage: string | null;
};

@Injectable()
export class OpsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getDatasources(): Promise<OpsDatasourcesResponse> {
    const datasources = await this.db
      .select({
        id: datasource.id,
        name: datasource.name,
        provider: datasource.provider,
        sourceType: datasource.sourceType,
        updateCycle: datasource.updateCycle,
        enabled: datasource.enabled,
      })
      .from(datasource)
      .orderBy(datasource.id);

    // datasource별 최신 run 1건 (DISTINCT ON + started_at desc).
    const lastRuns = await this.db
      .selectDistinctOn([opsIngestionRun.datasourceId], {
        id: opsIngestionRun.id,
        datasourceId: opsIngestionRun.datasourceId,
        status: opsIngestionRun.status,
        startedAt: opsIngestionRun.startedAt,
        finishedAt: opsIngestionRun.finishedAt,
        rowCount: opsIngestionRun.rowCount,
      })
      .from(opsIngestionRun)
      .orderBy(opsIngestionRun.datasourceId, desc(opsIngestionRun.startedAt));

    const qualityByRunId = await this.qualityCounts(lastRuns.map((run) => run.id));
    const lastRunByDatasourceId = new Map(lastRuns.map((run) => [run.datasourceId, run]));

    const items: OpsDatasourceItem[] = datasources.map((row) => {
      const lastRun = lastRunByDatasourceId.get(row.id);

      return {
        id: row.id,
        name: row.name,
        provider: row.provider,
        sourceType: row.sourceType,
        updateCycle: row.updateCycle,
        enabled: row.enabled,
        lastRun: lastRun
          ? {
              id: lastRun.id.toString(),
              status: lastRun.status as IngestionRunStatus,
              startedAt: lastRun.startedAt.toISOString(),
              finishedAt: lastRun.finishedAt?.toISOString() ?? null,
              rowCount: lastRun.rowCount,
              quality: qualityByRunId.get(lastRun.id.toString()) ?? emptyQualityCounts(),
            }
          : null,
      };
    });

    return { items };
  }

  async updateDatasource(id: number, body: OpsDatasourceUpdateBody): Promise<OpsDatasourceItem> {
    const [updated] = await this.db
      .update(datasource)
      .set({ enabled: body.enabled })
      .where(eq(datasource.id, id))
      .returning({
        id: datasource.id,
        name: datasource.name,
        provider: datasource.provider,
        sourceType: datasource.sourceType,
        updateCycle: datasource.updateCycle,
        enabled: datasource.enabled,
      });

    if (!updated) {
      throw new NotFoundException({ message: `Datasource ${id} not found` });
    }

    // 토글 응답은 목록 새로고침 전 낙관적 표시에만 쓰여 lastRun은 생략 가능하나,
    // 계약을 목록 item과 동일하게 유지한다.
    const [lastRun] = await this.db
      .select({
        id: opsIngestionRun.id,
        status: opsIngestionRun.status,
        startedAt: opsIngestionRun.startedAt,
        finishedAt: opsIngestionRun.finishedAt,
        rowCount: opsIngestionRun.rowCount,
      })
      .from(opsIngestionRun)
      .where(eq(opsIngestionRun.datasourceId, updated.id))
      .orderBy(desc(opsIngestionRun.startedAt))
      .limit(1);

    const quality = lastRun
      ? ((await this.qualityCounts([lastRun.id])).get(lastRun.id.toString()) ??
        emptyQualityCounts())
      : emptyQualityCounts();

    return {
      ...updated,
      lastRun: lastRun
        ? {
            id: lastRun.id.toString(),
            status: lastRun.status as IngestionRunStatus,
            startedAt: lastRun.startedAt.toISOString(),
            finishedAt: lastRun.finishedAt?.toISOString() ?? null,
            rowCount: lastRun.rowCount,
            quality,
          }
        : null,
    };
  }

  async getRuns(query: OpsRunsQuery): Promise<OpsRunsResponse> {
    const conditions = query.datasource ? [eq(datasource.name, query.datasource)] : [];

    const rows: (RunRow & { datasourceName: string })[] = await this.db
      .select({
        id: opsIngestionRun.id,
        datasourceId: opsIngestionRun.datasourceId,
        datasourceName: datasource.name,
        status: opsIngestionRun.status,
        startedAt: opsIngestionRun.startedAt,
        finishedAt: opsIngestionRun.finishedAt,
        requestedFrom: opsIngestionRun.requestedFrom,
        requestedTo: opsIngestionRun.requestedTo,
        rowCount: opsIngestionRun.rowCount,
        errorMessage: opsIngestionRun.errorMessage,
      })
      .from(opsIngestionRun)
      .innerJoin(datasource, eq(opsIngestionRun.datasourceId, datasource.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(opsIngestionRun.startedAt))
      .limit(query.limit);

    const qualityByRunId = await this.qualityCounts(rows.map((row) => row.id));

    const items: OpsRunItem[] = rows.map((row) => ({
      id: row.id.toString(),
      datasource: row.datasourceName,
      status: row.status as IngestionRunStatus,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      requestedFrom: row.requestedFrom?.toISOString() ?? null,
      requestedTo: row.requestedTo?.toISOString() ?? null,
      rowCount: row.rowCount,
      errorMessage: row.errorMessage,
      quality: qualityByRunId.get(row.id.toString()) ?? emptyQualityCounts(),
    }));

    return { items };
  }

  async triggerIngestion(body: OpsIngestionTriggerBody): Promise<OpsIngestionTriggerResponse> {
    const adapter = this.resolveAdapter(body.datasource);

    const [datasourceRow] = await this.db
      .select({ id: datasource.id, enabled: datasource.enabled })
      .from(datasource)
      .where(
        and(eq(datasource.name, adapter.datasourceName), eq(datasource.provider, adapter.provider)),
      )
      .limit(1);

    if (!datasourceRow) {
      throw new NotFoundException({
        message: `Datasource seed is missing for "${body.datasource}"`,
      });
    }

    if (!datasourceRow.enabled) {
      throw new ConflictException({
        message: `Datasource "${body.datasource}" is disabled`,
      });
    }

    // 범위 상한 — 동기 실행이라 interval 수 제한(기본은 어제 1일).
    const dateRange = this.resolveDateRange(body, adapter.dateRangeMode ?? 'kst-day');
    if (dateRange.ymds.length > MAX_TRIGGER_RANGE_DAYS) {
      throw new BadRequestException({
        message: `Requested range is ${dateRange.ymds.length} days; max is ${MAX_TRIGGER_RANGE_DAYS}`,
        details: [{ path: 'from', message: `range must be <= ${MAX_TRIGGER_RANGE_DAYS} days` }],
      });
    }

    // 동시 실행 가드: 최근 30분 내 'running'이 있으면 거부(그보다 오래된
    // running은 크래시 잔재로 간주).
    const staleCutoff = new Date(Date.now() - RUNNING_STALE_MINUTES * 60 * 1000);
    const [runningRow] = await this.db
      .select({ id: opsIngestionRun.id })
      .from(opsIngestionRun)
      .where(
        and(
          eq(opsIngestionRun.datasourceId, datasourceRow.id),
          eq(opsIngestionRun.status, 'running'),
          gt(opsIngestionRun.startedAt, staleCutoff),
        ),
      )
      .limit(1);

    if (runningRow) {
      throw new ConflictException({
        message: `Datasource "${body.datasource}" already has a running ingestion`,
      });
    }

    try {
      // 주의: closeIngestionResources() 호출 금지 — @solar/db pool은 API와 공유.
      const summary = await ingest({
        datasource: body.datasource,
        from: body.from,
        to: body.to,
      });

      return {
        ingestionRunId: summary.ingestionRunId.toString(),
        datasource: summary.datasource,
        status: summary.status,
        rowCount: summary.rowCount,
        successfulIntervals: summary.successfulIntervals,
        failedIntervals: summary.failedIntervals,
        ...(summary.errorMessage !== undefined && { errorMessage: summary.errorMessage }),
      };
    } catch (error) {
      // 사전 체크와 ingest 사이의 토글 race.
      if (error instanceof DatasourceDisabledError) {
        throw new ConflictException({
          message: `Datasource "${body.datasource}" is disabled`,
        });
      }
      throw error;
    }
  }

  private resolveAdapter(key: string): ReturnType<typeof getAdapter> {
    try {
      return getAdapter(key);
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : `Unsupported datasource "${key}"`,
        details: [{ path: 'datasource', message: 'unsupported datasource key' }],
      });
    }
  }

  private resolveDateRange(
    body: OpsIngestionTriggerBody,
    mode: 'kst-day' | 'utc-day',
  ): ReturnType<typeof resolveRequestedDateRange> {
    try {
      return resolveRequestedDateRange({ from: body.from, to: body.to }, new Date(), mode);
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'Invalid date range',
        details: [{ path: 'from', message: 'invalid date range' }],
      });
    }
  }

  /** run id 목록의 quality check 상태별 건수 집계. */
  private async qualityCounts(runIds: readonly bigint[]): Promise<Map<string, QualityCounts>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        ingestionRunId: opsDataQualityCheck.ingestionRunId,
        status: opsDataQualityCheck.status,
        checkCount: count(),
      })
      .from(opsDataQualityCheck)
      .where(inArray(opsDataQualityCheck.ingestionRunId, [...runIds]))
      .groupBy(opsDataQualityCheck.ingestionRunId, opsDataQualityCheck.status);

    const byRunId = new Map<string, QualityCounts>();

    for (const row of rows) {
      if (row.ingestionRunId === null) {
        continue;
      }

      const key = row.ingestionRunId.toString();
      const counts = byRunId.get(key) ?? emptyQualityCounts();

      if (row.status === 'pass' || row.status === 'warn' || row.status === 'fail') {
        counts[row.status] = row.checkCount;
      }

      byRunId.set(key, counts);
    }

    return byRunId;
  }
}

function emptyQualityCounts(): QualityCounts {
  return { pass: 0, warn: 0, fail: 0 };
}
