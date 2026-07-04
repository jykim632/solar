'use client';

import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { ChartContainer } from '@/components/charts/chart-container';
import { Card } from '@/components/ui/card';

/**
 * 수급 상황판 KPI + 차트 (목업 v4 이식, solar-742).
 * 데이터 소스 승인 대기 중 — 레이아웃 확인용 예시 시계열을 로컬 생성.
 * 실데이터 연결(r32.3)에서 이 더미 부분만 useQuery + bffFetch로 교체.
 */
const DEMO_SLOTS = 96; // 24h × 15분

function demoSeries(): { labels: string[]; demand: number[]; capacity: number[] } {
  const labels: string[] = [];
  const demand: number[] = [];
  const capacity: number[] = [];

  for (let i = 0; i < DEMO_SLOTS; i += 1) {
    const minutes = i * 15;
    const hh = String(Math.floor(minutes / 60) % 24).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    labels.push(`${hh}:${mm}`);
    // 낮 피크 형태의 부드러운 더미 곡선 (실데이터 아님).
    const phase = (i / DEMO_SLOTS) * Math.PI * 2;
    demand.push(Math.round(72000 + 8000 * Math.sin(phase - Math.PI / 2) + 1500 * Math.sin(phase * 3)));
    capacity.push(Math.round(90000 + 600 * Math.sin(phase)));
  }

  return { labels, demand, capacity };
}

const KPI = [
  { label: '현재수요', value: '—', unit: 'MW' },
  { label: '공급능력', value: '—', unit: 'MW' },
  { label: '공급예비력', value: '—', unit: 'MW' },
  { label: '공급예비율', value: '—', unit: '%' },
];

export function SupplyKpiCards() {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {KPI.map((kpi) => (
        <Card key={kpi.label} className="p-4">
          <div className="text-xs text-text-secondary">{kpi.label}</div>
          <div className="tabular mt-1 text-2xl font-semibold">
            {kpi.value} <span className="text-sm font-normal text-text-muted">{kpi.unit}</span>
          </div>
          <div className="mt-1 text-xs text-text-muted">수집 시작 후 표시</div>
        </Card>
      ))}
    </div>
  );
}

export function SupplyCharts() {
  const { labels, demand, capacity } = useMemo(demoSeries, []);

  const demandOption = useMemo<EChartsOption>(
    () => ({
      color: ['#3987e5', '#199e70'],
      tooltip: { trigger: 'axis' },
      legend: { top: 0, left: 0, icon: 'rect', itemWidth: 12, itemHeight: 3 },
      grid: { left: 64, right: 72, top: 32, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: false, data: labels },
      yAxis: { type: 'value', min: 55000, axisLabel: { formatter: (v: number) => v.toLocaleString() } },
      series: [
        { name: '현재수요', type: 'line', smooth: true, symbol: 'none', data: demand },
        { name: '공급능력', type: 'line', smooth: true, symbol: 'none', data: capacity },
      ],
    }),
    [labels, demand, capacity],
  );

  const reserveOption = useMemo<EChartsOption>(
    () => ({
      color: ['#3987e5'],
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 16, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: false, data: labels },
      yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [
        {
          name: '공급예비율',
          type: 'line',
          smooth: true,
          symbol: 'none',
          areaStyle: { opacity: 0.12 },
          data: labels.map((_, i) =>
            Number((((capacity[i] ?? 0) - (demand[i] ?? 0)) / (demand[i] ?? 1)) * 100).toFixed(1),
          ),
        },
      ],
    }),
    [labels, demand, capacity],
  );

  return (
    <>
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">최근 24시간 수요·공급능력</h2>
          <span className="text-xs text-text-muted">MW · 15분 단위 (예시)</span>
        </div>
        <ChartContainer option={demandOption} height={260} ariaLabel="24시간 수요·공급능력 차트" />
      </Card>
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">최근 24시간 공급예비율</h2>
          <span className="text-xs text-text-muted">% · 15분 단위 (예시)</span>
        </div>
        <ChartContainer option={reserveOption} height={200} ariaLabel="24시간 공급예비율 차트" />
      </Card>
    </>
  );
}
