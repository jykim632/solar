'use client';

import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChartContainer } from '@/components/charts/chart-container';

/**
 * 발전량·가격 대시보드 패널 (목업 v4 이식, solar-742).
 * 기간 preset/지역/시장 필터 + 발전량 추이 + SMP(소스 검증 중) + REC 가격.
 * 예시 데이터 — 실데이터 연결은 r32.4/r32.5에서 useQuery + bffFetch로 교체.
 */
const REGIONS = [
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
] as const;

const PERIODS = ['7일', '30일', '90일'] as const;

function demoDaily(days: number, base: number, amp: number): { labels: string[]; values: number[] } {
  const labels: string[] = [];
  const values: number[] = [];

  for (let i = 0; i < days; i += 1) {
    labels.push(`6/${i + 1}`);
    const phase = (i / days) * Math.PI * 4;
    values.push(Math.round(base + amp * Math.sin(phase) + amp * 0.4 * Math.sin(phase * 2.7)));
  }

  return { labels, values };
}

export function MarketPanels() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('30일');
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('경기');

  const gen = useMemo(() => demoDaily(30, 3800, 1000), []);
  const rec = useMemo(() => demoDaily(10, 74500, 400), []);

  const genOption = useMemo<EChartsOption>(
    () => ({
      color: ['#3987e5'],
      tooltip: { trigger: 'axis' },
      grid: { left: 56, right: 24, top: 24, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: false, data: gen.labels },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v.toLocaleString() } },
      series: [{ name: '발전량', type: 'line', smooth: false, symbol: 'none', data: gen.values }],
    }),
    [gen],
  );

  const recOption = useMemo<EChartsOption>(
    () => ({
      color: ['#3987e5', '#199e70'],
      tooltip: { trigger: 'axis' },
      legend: { top: 0, left: 0, icon: 'rect', itemWidth: 12, itemHeight: 3 },
      grid: { left: 64, right: 24, top: 32, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: false, data: rec.labels },
      yAxis: {
        type: 'value',
        min: 72000,
        axisLabel: { formatter: (v: number) => v.toLocaleString() },
      },
      series: [
        { name: '평균가', type: 'line', symbol: 'none', data: rec.values },
        {
          name: '종가 (육지)',
          type: 'line',
          symbol: 'none',
          data: rec.values.map((v) => v - 300),
        },
      ],
    }),
    [rec],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex overflow-hidden rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)' }}
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5"
              style={
                p === period
                  ? { background: 'color-mix(in oklab, var(--series-1) 15%, transparent)', fontWeight: 600 }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {p}
            </button>
          ))}
        </div>
        <select value={region} onChange={(e) => setRegion(e.target.value as (typeof REGIONS)[number])}>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select defaultValue="육지">
          <option>시장: 육지</option>
          <option>시장: 제주</option>
        </select>
      </div>

      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">태양광 발전량 — {region} (예시)</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            일 합계 · MWh
          </span>
        </div>
        <ChartContainer option={genOption} height={280} ariaLabel={`${region} 태양광 발전량 추이`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card flex flex-col p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">SMP — 육지</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              원/kWh · 시간별
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--status-warning)' }} />
              데이터 소스 검증 중
            </span>
            <p className="max-w-xs text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              기존 계통한계가격조회 API가 삭제 예정으로 안내되어 대체 소스를 검증하고 있습니다. 검증
              완료 전까지 SMP 시계열은 제공되지 않습니다.
            </p>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">REC 현물시장 가격 (예시)</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              원/REC · 거래일
            </span>
          </div>
          <ChartContainer option={recOption} height={240} ariaLabel="REC 현물시장 가격 추이" />
        </div>
      </div>
    </>
  );
}
