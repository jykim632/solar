'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { SupplyRealtimeResponseSchema, type SupplyRealtimeItem } from '@solar/api-contracts';
import { ChartContainer } from '@/components/charts/chart-container';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { ApiClientError, bffFetch } from '@/lib/bff-client';
import { DEMO_ORGANIZATION_ID, queryKeys } from '@/lib/query-keys';

/**
 * 수급 상황판 KPI + 차트 (solar-r32.3 실데이터 연결).
 * mart_supply_realtime → /api/bff/supply/realtime(BFF) → useQuery.
 * 실시간 5분 슬롯이라 지연이 없어 최근 24h 창 + 최신 슬롯 KPI를 그대로 쓴다.
 */
const WINDOW_HOURS = 24;

// slotAt(UTC instant)을 KST HH:mm 라벨로. 축 라벨/기준시각 표기에 사용(§4).
const KST_HHMM = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const KST_STAMP = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatError(error: Error | null): string {
  if (error instanceof ApiClientError) {
    return `${error.error.message} (${error.error.code})`;
  }
  return error?.message ?? '데이터를 불러오지 못했습니다.';
}

function formatMw(value: number | null): string {
  return value === null ? '—' : Math.round(value).toLocaleString();
}

function formatPct(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

export function SupplyDashboard() {
  const query = useQuery({
    queryKey: queryKeys.supplyRealtime(DEMO_ORGANIZATION_ID, WINDOW_HOURS),
    queryFn: () =>
      bffFetch(`/api/bff/supply/realtime?hours=${WINDOW_HOURS}`, SupplyRealtimeResponseSchema),
    // 5분 슬롯이라 브라우저에 오래 두지 않는다.
    refetchInterval: 5 * 60 * 1000,
  });

  const items = query.data?.items ?? [];
  const latest: SupplyRealtimeItem | undefined = items[items.length - 1];
  const latestSlotAt = query.data?.meta.latestSlotAt ?? null;

  const kpi = useMemo(
    () => [
      { label: '현재수요', value: formatMw(latest?.currentDemandMw ?? null), unit: 'MW' },
      { label: '공급능력', value: formatMw(latest?.supplyAbilityMw ?? null), unit: 'MW' },
      { label: '공급예비력', value: formatMw(latest?.reservePowerMw ?? null), unit: 'MW' },
      { label: '공급예비율', value: formatPct(latest?.reserveRatePct ?? null), unit: '%' },
    ],
    [latest],
  );

  const series = useMemo(() => {
    const labels = items.map((it) => KST_HHMM.format(new Date(it.slotAt)));
    return {
      labels,
      demand: items.map((it) => it.currentDemandMw),
      capacity: items.map((it) => it.supplyAbilityMw),
      reserveRate: items.map((it) => it.reserveRatePct),
    };
  }, [items]);

  const demandOption = useMemo<EChartsOption>(
    () => ({
      color: ['#3987e5', '#199e70'],
      tooltip: { trigger: 'axis' },
      legend: { top: 0, left: 0, icon: 'rect', itemWidth: 12, itemHeight: 3 },
      grid: { left: 64, right: 72, top: 32, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: false, data: series.labels },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { formatter: (v: number) => v.toLocaleString() },
      },
      series: [
        { name: '현재수요', type: 'line', smooth: true, symbol: 'none', data: series.demand },
        { name: '공급능력', type: 'line', smooth: true, symbol: 'none', data: series.capacity },
      ],
    }),
    [series],
  );

  const reserveOption = useMemo<EChartsOption>(
    () => ({
      color: ['#3987e5'],
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 16, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: false, data: series.labels },
      yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [
        {
          name: '공급예비율',
          type: 'line',
          smooth: true,
          symbol: 'none',
          areaStyle: { opacity: 0.12 },
          data: series.reserveRate,
        },
      ],
    }),
    [series],
  );

  const empty = !query.isLoading && !query.isError && items.length === 0;
  const stamp = latestSlotAt ? KST_STAMP.format(new Date(latestSlotAt)) : null;

  return (
    <>
      <PageHeader
        title="전력수급 상황판"
        scopeBadge="전국 계통 기준"
        description="지금 한국 전력계통이 얼마나 여유 있는지 보는 화면입니다. 예비율이 낮을수록 수급이 빠듯하고, 전력 도매가격(SMP)이 오르는 경향이 있습니다."
        status={
          query.isLoading ? (
            <span className="text-text-muted">기준시각 불러오는 중…</span>
          ) : stamp ? (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: 'var(--status-success, #199e70)' }}
              />
              데이터 기준 {stamp} (KST) · 수집된 최신 값
            </span>
          ) : (
            <span className="text-text-muted">수집된 데이터 없음</span>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpi.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-text-secondary">{k.label}</div>
            <div className="tabular mt-1 text-2xl font-semibold">
              {k.value} <span className="text-sm font-normal text-text-muted">{k.unit}</span>
            </div>
          </Card>
        ))}
      </div>

      {query.isError && (
        <p className="text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
          {formatError(query.error)}
        </p>
      )}
      {empty && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          표시할 데이터 없음 — 수집 실행 후 표시됩니다.
        </p>
      )}

      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">최근 24시간 수요·공급능력</h2>
          <span className="text-xs text-text-muted">MW · 5분 단위</span>
        </div>
        <ChartContainer
          option={demandOption}
          loading={query.isLoading}
          height={260}
          ariaLabel="24시간 수요·공급능력 차트"
        />
      </Card>
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">최근 24시간 공급예비율</h2>
          <span className="text-xs text-text-muted">% · 5분 단위</span>
        </div>
        <ChartContainer
          option={reserveOption}
          loading={query.isLoading}
          height={200}
          ariaLabel="24시간 공급예비율 차트"
        />
      </Card>
    </>
  );
}
