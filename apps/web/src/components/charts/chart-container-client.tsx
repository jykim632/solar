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
import { applyChartTheme, observeThemeChange, readChartTheme } from './chart-theme';

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
  // 최신 option을 ref로 들고 있어야 테마 전환 시 재적용할 수 있다.
  const optionRef = useRef(option);
  optionRef.current = option;

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

    // 다크/라이트 토글 시 canvas는 CSS 변수를 못 읽으므로 토큰을 다시 읽어
    // 축·그리드·툴팁 색상을 재주입한다.
    const disposeThemeObserver = observeThemeChange(() => {
      chart.setOption(applyChartTheme(optionRef.current, readChartTheme()), {
        notMerge: true,
        lazyUpdate: false,
      });
    });

    return () => {
      disposeThemeObserver();
      resizeObserver.disconnect();
      chart.dispose();

      if (chartRef.current === chart) {
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(applyChartTheme(option, readChartTheme()), {
      notMerge: true,
      lazyUpdate: false,
    });
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
