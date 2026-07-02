'use client';

import { useEffect, useRef } from 'react';
import type { EChartsOption, EChartsType } from 'echarts';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// Tree-shaken registry — P0/P1 화면은 line/bar 중심. 차트 타입 추가 시 여기에만 등록.
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type ChartRendererProps = {
  option: EChartsOption;
  loading?: boolean;
  ariaLabel?: string;
};

export function ChartContainerClient({
  option,
  loading = false,
  ariaLabel = 'Chart',
}: ChartRendererProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const chart = echarts.init(element, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const resize = () => chart.resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);

    resize();

    return () => {
      resizeObserver.disconnect();
      chart.dispose();

      if (chartRef.current === chart) {
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: false });
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    if (loading) {
      chart.showLoading('default');
    } else {
      chart.hideLoading();
    }
  }, [loading]);

  return (
    <div
      ref={elementRef}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', height: '100%', minHeight: '100%' }}
    />
  );
}
