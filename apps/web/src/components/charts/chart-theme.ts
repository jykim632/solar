import type { EChartsOption } from 'echarts';

/**
 * ECharts는 canvas 렌더러라 CSS 변수를 못 읽는다. 그래서 다크모드에서도
 * echarts 기본 테마(밝은 회색 splitLine·축)를 그대로 써서 어두운 배경 위에
 * 흰 그리드 선이 튀고 데이터 라인을 가린다. globals.css의 `.dark` 토큰
 * (--grid, --axis, --text-secondary/muted, --surface-1)을 읽어 축·그리드·
 * 툴팁·범례에 주입해 라이트/다크 양쪽에서 recessive한 축이 되도록 한다
 * (dataviz 규칙).
 *
 * 토큰은 :root와 `.dark` 둘 다에 정의돼 있고 next-themes가 `.dark`를 <html>에
 * 토글하므로, 테마 전환 시 이 값을 다시 읽어 재적용하면 된다.
 */
export interface ChartTheme {
  /** 축 이름·범례 등 일반 텍스트 (--text-secondary). */
  textColor: string;
  /** 축 눈금 라벨 (--text-muted). */
  mutedColor: string;
  /** 축선·눈금 (--axis). */
  axisColor: string;
  /** splitLine(그리드 선) (--grid). */
  gridColor: string;
  /** 툴팁 배경 (--surface-1). */
  surface: string;
}

const FALLBACK: ChartTheme = {
  textColor: '#52514e',
  mutedColor: '#898781',
  axisColor: '#c3c2b7',
  gridColor: '#e1e0d9',
  surface: '#fcfcfb',
};

export function readChartTheme(): ChartTheme {
  if (typeof window === 'undefined') {
    return FALLBACK;
  }
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    textColor: token('--text-secondary', FALLBACK.textColor),
    mutedColor: token('--text-muted', FALLBACK.mutedColor),
    axisColor: token('--axis', FALLBACK.axisColor),
    gridColor: token('--grid', FALLBACK.gridColor),
    surface: token('--surface-1', FALLBACK.surface),
  };
}

function axisDefaults(theme: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: theme.axisColor } },
    axisTick: { lineStyle: { color: theme.axisColor } },
    axisLabel: { color: theme.mutedColor },
    splitLine: { lineStyle: { color: theme.gridColor } },
  } as const;
}

// 사용자 축 옵션(axisLabel.formatter 등)은 유지하면서 색상 토큰만 덧입힌다.
// echarts는 xAxis/yAxis를 단일 객체 또는 배열로 받으므로 둘 다 처리한다.
// 제네릭 T로 xAxis/yAxis 각각의 타입을 그대로 반환한다.
function mergeAxis<T>(axis: T, defaults: ReturnType<typeof axisDefaults>): T {
  if (Array.isArray(axis)) {
    return axis.map((a) => mergeOne(a as Record<string, unknown>, defaults)) as T;
  }
  return mergeOne(axis as Record<string, unknown>, defaults) as T;
}

function mergeOne(
  axis: Record<string, unknown>,
  defaults: ReturnType<typeof axisDefaults>,
): Record<string, unknown> {
  const a = axis ?? {};
  const pick = (key: string) => (a[key] ?? {}) as Record<string, unknown>;
  const axisLine = pick('axisLine');
  const axisTick = pick('axisTick');
  const splitLine = pick('splitLine');
  return {
    ...a,
    axisLine: {
      ...defaults.axisLine,
      ...axisLine,
      lineStyle: { ...defaults.axisLine.lineStyle, ...(axisLine.lineStyle as object) },
    },
    axisTick: {
      ...defaults.axisTick,
      ...axisTick,
      lineStyle: { ...defaults.axisTick.lineStyle, ...(axisTick.lineStyle as object) },
    },
    axisLabel: { ...defaults.axisLabel, ...pick('axisLabel') },
    splitLine: {
      ...defaults.splitLine,
      ...splitLine,
      lineStyle: { ...defaults.splitLine.lineStyle, ...(splitLine.lineStyle as object) },
    },
  };
}

/**
 * 차트 옵션에 현재 테마의 축·그리드·툴팁·범례 색상을 주입한다. 사용자가
 * 명시한 필드는 보존하고(base를 먼저, 사용자를 나중에 spread), 색상만 채운다.
 */
export function applyChartTheme(option: EChartsOption, theme: ChartTheme): EChartsOption {
  const defaults = axisDefaults(theme);
  return {
    ...option,
    textStyle: { color: theme.textColor, ...option.textStyle },
    tooltip: option.tooltip
      ? {
          backgroundColor: theme.surface,
          borderColor: theme.axisColor,
          textStyle: { color: theme.textColor },
          ...option.tooltip,
        }
      : option.tooltip,
    legend: option.legend
      ? { textStyle: { color: theme.textColor }, ...option.legend }
      : option.legend,
    xAxis: option.xAxis ? mergeAxis(option.xAxis, defaults) : option.xAxis,
    yAxis: option.yAxis ? mergeAxis(option.yAxis, defaults) : option.yAxis,
  };
}

/**
 * <html>의 class 변경(next-themes의 다크 토글)을 구독한다. 반환된 함수로 해제.
 */
export function observeThemeChange(onChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}
