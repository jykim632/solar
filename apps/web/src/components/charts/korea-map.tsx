'use client';

import dynamic from 'next/dynamic';
import type { KoreaMapClientProps } from './korea-map-client';

/**
 * 한국 시도 choropleth (목업 v4 이식, solar-742).
 * GeoJSON은 로컬 번들(src/data) — CDN 의존 제거. ECharts map 시리즈는
 * SSR 불가라 ChartContainer와 같은 ssr:false 패턴을 쓴다.
 */
const KoreaMapRenderer = dynamic<KoreaMapClientProps>(
  () => import('./korea-map-client').then((m) => m.KoreaMapClient),
  { ssr: false, loading: () => null },
);

export type KoreaMapProps = KoreaMapClientProps & {
  height?: number | string;
};

export function KoreaMap({ height = 420, ...props }: KoreaMapProps) {
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div style={{ position: 'relative', width: '100%', height: resolvedHeight, minHeight: resolvedHeight }}>
      <KoreaMapRenderer {...props} />
    </div>
  );
}
