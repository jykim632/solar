'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OpsDatasourceItemSchema,
  OpsDatasourcesResponseSchema,
  OpsIngestionTriggerResponseSchema,
  OpsRunsResponseSchema,
  type IngestionRunStatus,
  type OpsIngestionTriggerResponse,
  type QualityCounts,
} from '@solar/api-contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiClientError, bffFetch } from '@/lib/bff-client';
import { DEMO_ORGANIZATION_ID, queryKeys } from '@/lib/query-keys';

/**
 * 수집 관리 패널 (solar-up3). datasource 카드(kill switch 토글 + 수동 실행) +
 * 최근 실행 이력 테이블. 수동 실행은 NestJS가 worker ingest를 동기 실행하므로
 * 완료(수십 초 가능)까지 pending 표시하고, 완료 시 목록·이력을 invalidate한다.
 */
const RUN_STATUS_META: Record<IngestionRunStatus, { label: string; color: string }> = {
  running: { label: '실행 중', color: 'var(--series-1)' },
  success: { label: '성공', color: 'var(--status-good, #199e70)' },
  partial: { label: '부분 성공', color: 'var(--status-warning, #b45309)' },
  failed: { label: '실패', color: 'var(--status-danger, #b91c1c)' },
};

const KST_DATETIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function instantToKstLabel(instant: string | null): string {
  return instant === null ? '—' : KST_DATETIME.format(new Date(instant));
}

function formatError(error: Error | null): string {
  if (error instanceof ApiClientError) {
    return `${error.error.message} (${error.error.code})`;
  }
  return error?.message ?? '요청에 실패했습니다.';
}

function RunStatusBadge({ status }: { status: IngestionRunStatus }) {
  const meta = RUN_STATUS_META[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: meta.color }}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}

function QualitySummary({ quality }: { quality: QualityCounts }) {
  const total = quality.pass + quality.warn + quality.fail;

  if (total === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        검사 없음
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs tabular-nums">
      <span style={{ color: 'var(--status-good, #199e70)' }}>pass {quality.pass}</span>
      {quality.warn > 0 && (
        <span style={{ color: 'var(--status-warning, #b45309)' }}>warn {quality.warn}</span>
      )}
      {quality.fail > 0 && (
        <span style={{ color: 'var(--status-danger, #b91c1c)' }}>fail {quality.fail}</span>
      )}
    </span>
  );
}

export function IngestionPanels() {
  const queryClient = useQueryClient();
  const [runFilter, setRunFilter] = useState<string>('');
  const [lastTrigger, setLastTrigger] = useState<{
    datasource: string;
    result?: OpsIngestionTriggerResponse;
    error?: string;
  } | null>(null);

  const datasourcesQuery = useQuery({
    queryKey: queryKeys.opsDatasources(DEMO_ORGANIZATION_ID),
    queryFn: () => bffFetch('/api/bff/ops/datasources', OpsDatasourcesResponseSchema),
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.opsRuns(DEMO_ORGANIZATION_ID, runFilter),
    queryFn: () => {
      const params = new URLSearchParams({ limit: '20' });
      if (runFilter !== '') {
        params.set('datasource', runFilter);
      }
      return bffFetch(`/api/bff/ops/runs?${params.toString()}`, OpsRunsResponseSchema);
    },
  });

  const invalidateOps = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.opsDatasources(DEMO_ORGANIZATION_ID) });
    void queryClient.invalidateQueries({
      queryKey: [...queryKeys.organization(DEMO_ORGANIZATION_ID), 'ops', 'runs'],
    });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      bffFetch(`/api/bff/ops/datasources/${id}`, OpsDatasourceItemSchema, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      }),
    onSettled: invalidateOps,
  });

  const triggerMutation = useMutation({
    mutationFn: (datasource: string) =>
      bffFetch('/api/bff/ops/ingestions', OpsIngestionTriggerResponseSchema, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasource }),
      }),
    onSuccess: (result, datasource) => {
      setLastTrigger({ datasource, result });
    },
    onError: (error, datasource) => {
      setLastTrigger({ datasource, error: formatError(error) });
    },
    onSettled: invalidateOps,
  });

  const datasources = datasourcesQuery.data?.items ?? [];
  const runs = runsQuery.data?.items ?? [];
  const datasourcesEmpty =
    !datasourcesQuery.isLoading && !datasourcesQuery.isError && datasources.length === 0;
  const runsEmpty = !runsQuery.isLoading && !runsQuery.isError && runs.length === 0;

  return (
    <>
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">데이터소스</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            수집 끔 = 스케줄·수동 실행 모두 건너뜀
          </span>
        </div>

        {datasourcesQuery.isLoading && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            불러오는 중…
          </p>
        )}
        {datasourcesQuery.isError && (
          <p className="mt-3 text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
            {formatError(datasourcesQuery.error)}
          </p>
        )}
        {datasourcesEmpty && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            표시할 데이터 없음
          </p>
        )}

        {datasources.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left text-xs"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <th className="py-2 pr-4 font-medium">데이터소스</th>
                  <th className="py-2 pr-4 font-medium">갱신 주기</th>
                  <th className="py-2 pr-4 font-medium">수집</th>
                  <th className="py-2 pr-4 font-medium">마지막 실행</th>
                  <th className="py-2 pr-4 font-medium">quality</th>
                  <th className="py-2 font-medium">수동 실행</th>
                </tr>
              </thead>
              <tbody>
                {datasources.map((ds) => {
                  const isToggling =
                    toggleMutation.isPending && toggleMutation.variables?.id === ds.id;
                  const isTriggering =
                    triggerMutation.isPending && triggerMutation.variables === ds.name;

                  return (
                    <tr
                      key={ds.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="py-2.5 pr-4">
                        <div className="font-medium">{ds.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {ds.provider} · {ds.sourceType}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {ds.updateCycle ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={ds.enabled ? 'secondary' : 'destructive'}>
                            {ds.enabled ? '켜짐' : '꺼짐'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={isToggling}
                            onClick={() =>
                              toggleMutation.mutate({ id: ds.id, enabled: !ds.enabled })
                            }
                          >
                            {isToggling ? '변경 중…' : ds.enabled ? '끄기' : '켜기'}
                          </Button>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        {ds.lastRun ? (
                          <div className="flex flex-col gap-0.5">
                            <RunStatusBadge status={ds.lastRun.status} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {instantToKstLabel(ds.lastRun.startedAt)} ·{' '}
                              {(ds.lastRun.rowCount ?? 0).toLocaleString()}행
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            실행 이력 없음
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {ds.lastRun ? (
                          <QualitySummary quality={ds.lastRun.quality} />
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={!ds.enabled || triggerMutation.isPending}
                          onClick={() => triggerMutation.mutate(ds.name)}
                        >
                          {isTriggering ? '실행 중…' : '실행'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {toggleMutation.isError && (
          <p className="mt-2 text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
            {formatError(toggleMutation.error)}
          </p>
        )}
        {lastTrigger && (
          <p
            className="mt-2 text-xs"
            style={{
              color: lastTrigger.error
                ? 'var(--status-danger, #b91c1c)'
                : 'var(--text-secondary)',
            }}
          >
            {lastTrigger.error
              ? `${lastTrigger.datasource} 수동 실행 실패: ${lastTrigger.error}`
              : `${lastTrigger.datasource} 수동 실행 완료: ${
                  RUN_STATUS_META[lastTrigger.result!.status].label
                } · ${lastTrigger.result!.rowCount.toLocaleString()}행 (run #${lastTrigger.result!.ingestionRunId})`}
          </p>
        )}
        {triggerMutation.isPending && (
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            수동 실행 중 — 원천 API 호출을 포함해 수십 초까지 걸릴 수 있습니다.
          </p>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">최근 수집 실행</h2>
          <select value={runFilter} onChange={(e) => setRunFilter(e.target.value)}>
            <option value="">전체 데이터소스</option>
            {datasources.map((ds) => (
              <option key={ds.id} value={ds.name}>
                {ds.name}
              </option>
            ))}
          </select>
        </div>

        {runsQuery.isLoading && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            불러오는 중…
          </p>
        )}
        {runsQuery.isError && (
          <p className="mt-3 text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
            {formatError(runsQuery.error)}
          </p>
        )}
        {runsEmpty && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            표시할 데이터 없음
          </p>
        )}

        {runs.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left text-xs"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <th className="py-2 pr-4 font-medium">시작 (KST)</th>
                  <th className="py-2 pr-4 font-medium">데이터소스</th>
                  <th className="py-2 pr-4 font-medium">상태</th>
                  <th className="py-2 pr-4 font-medium">수집 범위</th>
                  <th className="py-2 pr-4 font-medium">행수</th>
                  <th className="py-2 font-medium">quality</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b align-top last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="py-2.5 pr-4 text-xs tabular-nums">
                      {instantToKstLabel(run.startedAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs">{run.datasource}</td>
                    <td className="py-2.5 pr-4">
                      <RunStatusBadge status={run.status} />
                      {run.errorMessage && (
                        <p
                          className="mt-0.5 max-w-xs truncate text-xs"
                          style={{ color: 'var(--text-muted)' }}
                          title={run.errorMessage}
                        >
                          {run.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-xs tabular-nums">
                      {instantToKstLabel(run.requestedFrom)} ~ {instantToKstLabel(run.requestedTo)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs tabular-nums">
                      {(run.rowCount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2.5">
                      <QualitySummary quality={run.quality} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
