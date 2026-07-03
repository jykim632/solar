'use client';

import { useEffect, useRef } from 'react';
import { MapChart } from 'echarts/charts';
import { TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import koreaGeo from '@/data/skorea-provinces-geo.json';

echarts.use([MapChart, TooltipComponent, VisualMapComponent, CanvasRenderer]);

// GeoJSON(구명칭) feature name — region_code 매핑. GeoJSON과 KPX 응답이
// 같은 구명칭 계열(강원도/전라북도)이라 region_name(특별자치도)이 아닌
// 이 테이블로 잇는다.
export const GEO_NAME_TO_REGION_CODE: Record<string, string> = {
  서울특별시: 'SEOUL',
  부산광역시: 'BUSAN',
  대구광역시: 'DAEGU',
  인천광역시: 'INCHEON',
  광주광역시: 'GWANGJU',
  대전광역시: 'DAEJEON',
  울산광역시: 'ULSAN',
  세종특별자치시: 'SEJONG',
  경기도: 'GYEONGGI',
  강원도: 'GANGWON',
  충청북도: 'CHUNGBUK',
  충청남도: 'CHUNGNAM',
  전라북도: 'JEONBUK',
  전라남도: 'JEONNAM',
  경상북도: 'GYEONGBUK',
  경상남도: 'GYEONGNAM',
  제주특별자치도: 'JEJU',
};

let mapRegistered = false;

function ensureMapRegistered(): void {
  if (!mapRegistered) {
    echarts.registerMap('korea', koreaGeo as Parameters<typeof echarts.registerMap>[1]);
    mapRegistered = true;
  }
}

export interface KoreaMapDatum {
  /** GeoJSON feature name (구명칭 — GEO_NAME_TO_REGION_CODE의 key). */
  name: string;
  value: number;
}

export interface KoreaMapClientProps {
  data: KoreaMapDatum[];
  max: number;
  /** 선택된 지역의 GeoJSON name. */
  selectedName?: string;
  valueUnit?: string;
  onSelect?(geoName: string, regionCode: string): void;
}

export function KoreaMapClient({
  data,
  max,
  selectedName,
  valueUnit = 'MWh',
  onSelect,
}: KoreaMapClientProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    ensureMapRegistered();
    const chart = echarts.init(element, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    chart.on('selectchanged', (params) => {
      const event = params as { fromActionPayload?: { dataIndexInside?: number } };
      const idx = event.fromActionPayload?.dataIndexInside;
      if (idx == null) {
        return;
      }
      const option = chart.getOption() as { series?: { data?: KoreaMapDatum[] }[] };
      const datum = option.series?.[0]?.data?.[idx];
      if (datum?.name) {
        onSelectRef.current?.(datum.name, GEO_NAME_TO_REGION_CODE[datum.name] ?? 'UNKNOWN');
      }
    });

    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    return () => {
      observer.disconnect();
      chart.dispose();
      if (chartRef.current === chart) {
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(
      {
        tooltip: {
          formatter: (p: { name: string; value?: number }) =>
            `${p.name}<br/><strong>${(p.value ?? 0).toLocaleString()} ${valueUnit}</strong>`,
        },
        visualMap: {
          min: 0,
          max,
          left: 0,
          bottom: 0,
          text: ['높음', '낮음'],
          textStyle: { fontSize: 11 },
          // sequential blue 100→700 (dataviz 규칙 — 크기 인코딩 단일 색상)
          inRange: { color: ['#cde2fb', '#0d366b'] },
          calculable: false,
          itemWidth: 12,
          itemHeight: 80,
        },
        series: [
          {
            name: '태양광 발전량',
            type: 'map',
            map: 'korea',
            roam: false,
            selectedMode: 'single',
            itemStyle: { borderWidth: 1 },
            emphasis: { label: { show: true, fontSize: 11 } },
            select: { label: { show: true, fontWeight: 600 }, itemStyle: { borderWidth: 2 } },
            label: { show: false },
            data: data.map((d) => ({ ...d, selected: d.name === selectedName })),
          },
        ],
      },
      { notMerge: true },
    );
  }, [data, max, selectedName, valueUnit]);

  return <div ref={elementRef} style={{ width: '100%', height: '100%', minHeight: '100%' }} />;
}
