'use client';

import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChartContainer } from '@/components/charts/chart-container';
import { KoreaMap } from '@/components/charts/korea-map';
import type { KoreaMapDatum } from '@/components/charts/korea-map-client';

/**
 * 발전량·가격 대시보드 패널 (목업 v4 이식, solar-742).
 * choropleth 지도 클릭 ↔ 지역 select 양방향 동기화. 예시 데이터 —
 * 실데이터 연결은 r32.4/r32.5에서 useQuery + bffFetch로 교체.
 */
const PERIODS = ['7일', '30일', '90일'] as const;

// GeoJSON name(구명칭) ↔ 짧은 표시명. 목업 v4의 REGION_GEN/REGION_SHORT.
const REGION_OPTIONS = [
  { geoName: '경기도', short: '경기' },
  { geoName: '강원도', short: '강원' },
  { geoName: '충청북도', short: '충북' },
  { geoName: '충청남도', short: '충남' },
  { geoName: '전라북도', short: '전북' },
  { geoName: '전라남도', short: '전남' },
  { geoName: '경상북도', short: '경북' },
  { geoName: '경상남도', short: '경남' },
  { geoName: '제주특별자치도', short: '제주' },
  { geoName: '서울특별시', short: '서울' },
  { geoName: '부산광역시', short: '부산' },
  { geoName: '대구광역시', short: '대구' },
  { geoName: '인천광역시', short: '인천' },
  { geoName: '광주광역시', short: '광주' },
  { geoName: '대전광역시', short: '대전' },
  { geoName: '울산광역시', short: '울산' },
  { geoName: '세종특별자치시', short: '세종' },
] as const;

// 예시 지도 데이터 (목업 v4 더미 — 실데이터는 r32.4에서).
const DEMO_MAP_DATA: KoreaMapDatum[] = [
  { name: '전라남도', value: 5840 },
  { name: '경상북도', value: 4920 },
  { name: '전라북도', value: 4310 },
  { name: '충청남도', value: 4150 },
  { name: '경기도', value: 3480 },
  { name: '경상남도', value: 3120 },
  { name: '강원도', value: 2660 },
  { name: '충청북도', value: 2380 },
  { name: '제주특별자치도', value: 1240 },
  { name: '인천광역시', value: 610 },
  { name: '세종특별자치시', value: 420 },
  { name: '울산광역시', value: 390 },
  { name: '대구광역시', value: 350 },
  { name: '광주광역시', value: 330 },
  { name: '부산광역시', value: 310 },
  { name: '대전광역시', value: 210 },
  { name: '서울특별시', value: 90 },
];

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
  const [regionGeoName, setRegionGeoName] = useState<string>('경기도');

  const regionShort =
    REGION_OPTIONS.find((r) => r.geoName === regionGeoName)?.short ?? regionGeoName;

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
        <select value={regionGeoName} onChange={(e) => setRegionGeoName(e.target.value)}>
          {REGION_OPTIONS.map((r) => (
            <option key={r.geoName} value={r.geoName}>
              {r.short}
            </option>
          ))}
        </select>
        <select defaultValue="육지">
          <option>시장: 육지</option>
          <option>시장: 제주</option>
        </select>
      </div>

      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">지역별 태양광 발전량 (예시)</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            일 합계 · MWh
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div>
            <KoreaMap
              data={DEMO_MAP_DATA}
              max={6000}
              selectedName={regionGeoName}
              onSelect={(geoName) => setRegionGeoName(geoName)}
              height={400}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              지도에서 지역을 클릭하면 오른쪽 추이가 해당 지역으로 바뀝니다.
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium">태양광 발전량 — {regionShort}</h3>
            </div>
            <ChartContainer
              option={genOption}
              height={360}
              ariaLabel={`${regionShort} 태양광 발전량 추이`}
            />
          </div>
        </div>
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
