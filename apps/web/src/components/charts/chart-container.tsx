'use client';

import dynamic from 'next/dynamic';
import type { CSSProperties } from 'react';
import type { ChartRendererProps } from './chart-container-client';

/**
 * §7.2 단일 차트 래퍼 (solar-8wv.13). ECharts는 window/canvas 의존이라 서버
 * 렌더 불가 — ssr:false dynamic import와 명시적 height(0px 렌더 버그 방지)를
 * 이 한곳에서 처리한다. 모든 차트 화면은 이 컴포넌트만 사용한다.
 *
 * echarts-for-react@3.0.2는 peer가 echarts ^3||^4||^5라 echarts 6과 비호환 —
 * echarts/core를 직접 쓴다(chart-container-client.tsx).
 */
const ChartRenderer = dynamic<ChartRendererProps>(
  () => import('./chart-container-client').then((module) => module.ChartContainerClient),
  { ssr: false, loading: () => null },
);

export type ChartContainerProps = ChartRendererProps & {
  height?: number | string;
  className?: string;
  style?: CSSProperties;
};

export function ChartContainer({
  option,
  loading = false,
  height = 320,
  ariaLabel = 'Chart',
  className,
  style,
}: ChartContainerProps) {
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={className}
      style={{
        ...style,
        position: 'relative',
        width: style?.width ?? '100%',
        height: resolvedHeight,
        minHeight: resolvedHeight,
      }}
    >
      <ChartRenderer option={option} loading={loading} ariaLabel={ariaLabel} />
    </div>
  );
}
