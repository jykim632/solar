'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import {
  GenerationHourlyResponseSchema,
  RecDailyResponseSchema,
  SmpHourlyResponseSchema,
  type MarketArea,
} from '@solar/api-contracts';
import { ChartContainer } from '@/components/charts/chart-container';
import { KoreaMap } from '@/components/charts/korea-map';
import {
  GEO_NAME_TO_REGION_CODE,
  type KoreaMapDatum,
} from '@/components/charts/korea-map-client';
import { ApiClientError, bffFetch } from '@/lib/bff-client';
import { DEMO_ORGANIZATION_ID, queryKeys } from '@/lib/query-keys';

/**
 * 발전량·가격 대시보드 패널 (목업 v4 이식, solar-742; 실데이터 연결 solar-r32.4).
 * choropleth 지도 클릭 ↔ 지역 select 양방향 동기화.
 *
 * 데이터는 BFF(useQuery + bffFetch)로 연결한다. 발전량은 ~2개월 지연이라
 * "today" 기준 창은 대부분 비므로, latest 쿼리로 meta.latestAvailableSourceDate를
 * 먼저 얻어 모든 발전량 윈도우의 앵커로 쓴다(§5.4/§10). SMP는 대체 소스 확정
 * (solar-2af.6, 하루전 발전계획용)으로 시간별 차트를 연결한다(solar-r32.7) —
 * 서버 기본 7일 창, 시장(육지/제주) select 연동.
 */
const PERIODS = ['7일', '30일', '90일'] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_DAYS: Record<Period, number> = { '7일': 7, '30일': 30, '90일': 90 };

// GeoJSON name(구명칭) ↔ 짧은 표시명. 목업 v4의 REGION_GEN/REGION_SHORT.
// select·지도는 geoName 공간에서 동작하고, API 호출만 region_code로 변환한다.
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

// region_code → GeoJSON name (GEO_NAME_TO_REGION_CODE 역매핑). 지도 datum은
// GeoJSON name 공간이라 API의 regionCode를 다시 구명칭으로 되돌린다.
const REGION_CODE_TO_GEO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(GEO_NAME_TO_REGION_CODE).map(([geoName, code]) => [code, geoName]),
);

// intervalStartAt(UTC instant)은 KST 자정의 순간 — KST 달력일로 M/D 라벨 산출(§4).
const KST_MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
});

function instantToKstMonthDay(instant: string): string {
  return KST_MONTH_DAY.format(new Date(instant));
}

// SMP 시간별 라벨 — KST M/D HH시.
const KST_MONTH_DAY_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hour12: false,
});

function instantToKstMonthDayHour(instant: string): string {
  const parts = KST_MONTH_DAY_HOUR.formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')}/${get('day')} ${get('hour')}시`;
}

const MARKET_AREA_OPTIONS = [
  { area: 'LAND', label: '육지' },
  { area: 'JEJU', label: '제주' },
] as const;

// YYYY-MM-DD → [year, month, day]. 숫자 3개를 보장(불량 입력은 0으로 폴백).
function parseIsoDate(isoDate: string): [number, number, number] {
  const parts = isoDate.split('-').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

// tradeDate는 이미 KST 달력일(YYYY-MM-DD)이라 문자열 분해로 M/D를 만든다(TZ 무관).
function isoDateToMonthDay(isoDate: string): string {
  const [, month, day] = parseIsoDate(isoDate);
  return `${month}/${day}`;
}

// YYYY-MM-DD에 일수를 더한다(UTC 고정 — 달력일 산술만, TZ 이동 없음).
function addDays(isoDate: string, delta: number): string {
  const [year, month, day] = parseIsoDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function formatError(error: Error | null): string {
  if (error instanceof ApiClientError) {
    return `${error.error.message} (${error.error.code})`;
  }
  return error?.message ?? '데이터를 불러오지 못했습니다.';
}

export function MarketPanels() {
  const [period, setPeriod] = useState<Period>('30일');
  const [regionGeoName, setRegionGeoName] = useState<string>('경기도');
  const [marketArea, setMarketArea] = useState<MarketArea>('LAND');

  const periodDays = PERIOD_DAYS[period];
  const regionShort =
    REGION_OPTIONS.find((r) => r.geoName === regionGeoName)?.short ?? regionGeoName;
  const regionCode = GEO_NAME_TO_REGION_CODE[regionGeoName] ?? '';

  // 1) latest — 최신 source_date 앵커. limit=1로 meta만 확인한다.
  const latestQuery = useQuery({
    queryKey: queryKeys.generationLatest(DEMO_ORGANIZATION_ID),
    queryFn: () =>
      bffFetch('/api/bff/generation/daily?limit=1', GenerationHourlyResponseSchema),
  });

  const latestDate = latestQuery.data?.meta.latestAvailableSourceDate ?? null;
  const genFrom = latestDate ? addDays(latestDate, -(periodDays - 1)) : '';
  const genTo = latestDate ?? '';

  // 2) generation — 선택 지역의 일별 추이. region/from/to 변경 시 key가 바뀌어 refetch.
  const generationQuery = useQuery({
    queryKey: queryKeys.generationDaily(DEMO_ORGANIZATION_ID, regionCode, genFrom, genTo),
    queryFn: () => {
      const params = new URLSearchParams({
        region: regionCode,
        from: genFrom,
        to: genTo,
        limit: String(periodDays),
      });
      return bffFetch(
        `/api/bff/generation/daily?${params.toString()}`,
        GenerationHourlyResponseSchema,
      );
    },
    enabled: latestDate !== null && regionCode !== '',
  });

  // 3) map — 최신일의 지역별 스냅샷(region 미지정 → 17개 지역 1일).
  const mapQuery = useQuery({
    queryKey: queryKeys.generationMapDaily(DEMO_ORGANIZATION_ID, genTo),
    queryFn: () => {
      const params = new URLSearchParams({ from: genTo, to: genTo, limit: '100' });
      return bffFetch(
        `/api/bff/generation/daily?${params.toString()}`,
        GenerationHourlyResponseSchema,
      );
    },
    enabled: latestDate !== null,
  });

  // 4) rec — 서버 기본 90일 창을 한 번 받고, 기간 필터는 클라이언트에서(refetch 없음).
  const recQuery = useQuery({
    queryKey: queryKeys.recDaily(DEMO_ORGANIZATION_ID, 'LAND'),
    queryFn: () => bffFetch('/api/bff/rec/daily?area=LAND', RecDailyResponseSchema),
  });

  // 5) smp — 서버 기본 7일 창(하루전 예측 소스라 내일까지 포함될 수 있음).
  // 시간별 데이터라 기간 토글과 무관하게 최근 창 고정, 시장 select만 연동.
  const smpQuery = useQuery({
    queryKey: queryKeys.smpHourly(DEMO_ORGANIZATION_ID, marketArea),
    queryFn: () =>
      bffFetch(`/api/bff/smp/hourly?area=${marketArea}&limit=1000`, SmpHourlyResponseSchema),
  });

  const gen = useMemo(() => {
    const points = [...(generationQuery.data?.items ?? [])].sort((a, b) =>
      a.intervalStartAt.localeCompare(b.intervalStartAt),
    );
    return {
      labels: points.map((p) => instantToKstMonthDay(p.intervalStartAt)),
      values: points.map((p) => p.generationMwh),
    };
  }, [generationQuery.data]);

  const map = useMemo(() => {
    const data: KoreaMapDatum[] = (mapQuery.data?.items ?? [])
      .map((item) => ({
        name: REGION_CODE_TO_GEO_NAME[item.regionCode] ?? '',
        value: item.generationMwh,
      }))
      .filter((d) => d.name !== '');
    const peak = data.length ? Math.max(...data.map((d) => d.value)) : 0;
    // visualMap 상한: 데이터 최댓값을 1,000 단위로 올림(최소 1,000).
    const max = peak > 0 ? Math.ceil(peak / 1000) * 1000 : 1000;
    return { data, max };
  }, [mapQuery.data]);

  const smp = useMemo(() => {
    const points = [...(smpQuery.data?.items ?? [])].sort((a, b) =>
      a.intervalStartAt.localeCompare(b.intervalStartAt),
    );
    return {
      labels: points.map((p) => instantToKstMonthDayHour(p.intervalStartAt)),
      values: points.map((p) => p.smpKrwPerKwh),
    };
  }, [smpQuery.data]);

  const rec = useMemo(() => {
    const items = (recQuery.data?.items ?? []).filter((i) => i.marketArea === 'LAND');
    const firstItem = items[0];
    if (firstItem === undefined) {
      return { labels: [] as string[], avg: [] as (number | null)[], close: [] as (number | null)[] };
    }
    // 최신 거래일 기준 기간 창으로 클라이언트 필터(거래일 Tue/Thu만 있어 sparse가 정상).
    const maxTradeDate = items.reduce((acc, i) => (i.tradeDate > acc ? i.tradeDate : acc), firstItem.tradeDate);
    const windowStart = addDays(maxTradeDate, -(periodDays - 1));
    const windowed = items
      .filter((i) => i.tradeDate >= windowStart)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
    return {
      labels: windowed.map((i) => isoDateToMonthDay(i.tradeDate)),
      avg: windowed.map((i) => i.avgPriceKrwPerRec),
      close: windowed.map((i) => i.closePriceKrwPerRec),
    };
  }, [recQuery.data, periodDays]);

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

  const smpOption = useMemo<EChartsOption>(
    () => ({
      color: ['#e58e39'],
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 24, bottom: 28 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: smp.labels,
        axisLabel: { interval: 23 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { formatter: (v: number) => v.toLocaleString() },
      },
      series: [{ name: 'SMP', type: 'line', smooth: false, symbol: 'none', data: smp.values }],
    }),
    [smp],
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
        scale: true,
        axisLabel: { formatter: (v: number) => v.toLocaleString() },
      },
      series: [
        { name: '평균가', type: 'line', symbol: 'none', data: rec.avg },
        { name: '종가 (육지)', type: 'line', symbol: 'none', data: rec.close },
      ],
    }),
    [rec],
  );

  const genLoading = latestQuery.isLoading || generationQuery.isLoading;
  const genError = latestQuery.error ?? generationQuery.error;
  const genEmpty = !genLoading && !genError && gen.values.length === 0;
  const mapEmpty = !latestQuery.isLoading && !mapQuery.isLoading && !mapQuery.error && map.data.length === 0;
  const recEmpty = !recQuery.isLoading && !recQuery.isError && rec.labels.length === 0;
  const smpEmpty = !smpQuery.isLoading && !smpQuery.isError && smp.values.length === 0;
  const smpLatest = smpQuery.data?.meta.latestAvailableSourceDate ?? null;
  const marketAreaLabel =
    MARKET_AREA_OPTIONS.find((o) => o.area === marketArea)?.label ?? marketArea;

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
        <select value={marketArea} onChange={(e) => setMarketArea(e.target.value as MarketArea)}>
          {MARKET_AREA_OPTIONS.map((o) => (
            <option key={o.area} value={o.area}>
              시장: {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">지역별 태양광 발전량</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            일 합계 · MWh
          </span>
        </div>
        {latestDate && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            기준일 {latestDate} · 발전량 데이터는 약 2개월 지연
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div>
            <KoreaMap
              data={map.data}
              max={map.max}
              selectedName={regionGeoName}
              onSelect={(geoName) => setRegionGeoName(geoName)}
              height={400}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              지도에서 지역을 클릭하면 오른쪽 추이가 해당 지역으로 바뀝니다.
            </p>
            {mapQuery.isError && (
              <p className="mt-1 text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
                {formatError(mapQuery.error)}
              </p>
            )}
            {mapEmpty && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                표시할 데이터 없음
              </p>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium">태양광 발전량 — {regionShort}</h3>
            </div>
            <ChartContainer
              option={genOption}
              loading={genLoading}
              height={360}
              ariaLabel={`${regionShort} 태양광 발전량 추이`}
            />
            {genError && (
              <p className="text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
                {formatError(genError)}
              </p>
            )}
            {genEmpty && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                표시할 데이터 없음
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">SMP — {marketAreaLabel}</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              원/kWh · 시간별
            </span>
          </div>
          {smpLatest && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              기준일 {smpLatest} · 하루전 발전계획용 확정가 (실시간 정산가 아님)
            </p>
          )}
          <ChartContainer
            option={smpOption}
            loading={smpQuery.isLoading}
            height={240}
            ariaLabel={`${marketAreaLabel} SMP 시간별 추이`}
          />
          {smpQuery.isError && (
            <p className="text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
              {formatError(smpQuery.error)}
            </p>
          )}
          {smpEmpty && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              표시할 데이터 없음
            </p>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">REC 현물시장 가격</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              원/REC · 거래일
            </span>
          </div>
          <ChartContainer
            option={recOption}
            loading={recQuery.isLoading}
            height={240}
            ariaLabel="REC 현물시장 가격 추이"
          />
          {recQuery.isError && (
            <p className="text-xs" style={{ color: 'var(--status-danger, #b91c1c)' }}>
              {formatError(recQuery.error)}
            </p>
          )}
          {recEmpty && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              표시할 데이터 없음
            </p>
          )}
        </div>
      </div>
    </>
  );
}
