'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { ChartContainer } from '@/components/charts/chart-container';
import { ApiClientError, bffFetch } from '@/lib/bff-client';
import { DEMO_ORGANIZATION_ID, queryKeys } from '@/lib/query-keys';
import {
  SimulatorFormSchema,
  SpikeHourlyGenerationResponseSchema,
  simulatorFormToWire,
  type SimulatorFormValues,
  type SimulatorWirePayload,
} from './spike-schemas';

export function SpikeDemo() {
  const [submittedWire, setSubmittedWire] = useState<SimulatorWirePayload | null>(null);

  const generationQuery = useQuery({
    queryKey: queryKeys.spikeHourlyGeneration(DEMO_ORGANIZATION_ID),
    queryFn: () =>
      bffFetch('/api/bff/spike/hourly-generation', SpikeHourlyGenerationResponseSchema),
  });

  const chartOption = useMemo<EChartsOption>(() => {
    const points = generationQuery.data?.points ?? [];

    return {
      color: ['#0f766e'],
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 32, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map((point) => point.hour),
      },
      yAxis: {
        type: 'value',
        name: 'kWh',
      },
      series: [
        {
          name: '발전량',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          areaStyle: { opacity: 0.14 },
          data: points.map((point) => point.generationKwh),
        },
      ],
    };
  }, [generationQuery.data]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SimulatorFormValues>({
    resolver: zodResolver(SimulatorFormSchema),
    defaultValues: {
      capacityKw: '500',
      performanceRatio: '0.82',
    },
  });

  const onSubmit: SubmitHandler<SimulatorFormValues> = (values) => {
    setSubmittedWire(simulatorFormToWire(values));
  };

  const dailyEstimateKwh =
    submittedWire === null ? null : submittedWire.capacityKw * submittedWire.performanceRatio * 4.1;

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1040 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Week-1 프론트 스파이크</h1>
        <p style={{ marginTop: 8, color: '#4b5563' }}>
          ChartContainer + form/wire 스키마 분리 + BFF fetch 래퍼 검증 페이지.
        </p>
      </header>

      <section style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>시간별 발전량 (샘플)</h2>
            <p style={{ marginTop: 4, marginBottom: 0, color: '#6b7280' }}>
              Organization: {generationQuery.data?.organizationId ?? DEMO_ORGANIZATION_ID}
            </p>
          </div>
          {generationQuery.isFetching && <span style={{ color: '#6b7280' }}>불러오는 중...</span>}
        </div>

        {generationQuery.isError && (
          <p style={{ color: '#b91c1c' }}>{formatError(generationQuery.error)}</p>
        )}

        <div style={{ marginTop: 16 }}>
          <ChartContainer
            option={chartOption}
            loading={generationQuery.isLoading}
            height={360}
            ariaLabel="시간별 태양광 발전량 라인 차트"
          />
        </div>
      </section>

      <section
        style={{
          border: '1px solid #d1d5db',
          borderRadius: 8,
          padding: 16,
          marginTop: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>시뮬레이터 입력 (form/wire 분리 데모)</h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>설비용량 (kW)</span>
            <input
              {...register('capacityKw')}
              inputMode="decimal"
              style={{ padding: 8, border: '1px solid #9ca3af', borderRadius: 6 }}
            />
            {errors.capacityKw && (
              <span style={{ color: '#b91c1c' }}>{errors.capacityKw.message}</span>
            )}
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>효율 (PR)</span>
            <input
              {...register('performanceRatio')}
              inputMode="decimal"
              style={{ padding: 8, border: '1px solid #9ca3af', borderRadius: 6 }}
            />
            {errors.performanceRatio && (
              <span style={{ color: '#b91c1c' }}>{errors.performanceRatio.message}</span>
            )}
          </label>

          <div style={{ alignSelf: 'end' }}>
            <button type="submit" disabled={isSubmitting} style={{ padding: '9px 14px' }}>
              변환
            </button>
          </div>
        </form>

        {submittedWire && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Wire payload (API body)</h3>
            <pre
              style={{
                background: '#f3f4f6',
                borderRadius: 6,
                overflowX: 'auto',
                padding: 12,
              }}
            >
              {JSON.stringify(submittedWire, null, 2)}
            </pre>
            <p style={{ marginBottom: 0 }}>
              일 발전량 추정: {formatNumber(dailyEstimateKwh)} kWh (가정 기반 시뮬레이션 —
              실제 정산 아님)
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function formatError(error: Error | null): string {
  if (error instanceof ApiClientError) {
    return `${error.error.message} (${error.error.code})`;
  }

  return error?.message ?? 'Failed to load data.';
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
  }).format(value);
}
