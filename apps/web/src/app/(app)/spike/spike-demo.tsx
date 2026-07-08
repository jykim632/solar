'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { ChartContainer } from '@/components/charts/chart-container';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <main className="mx-auto max-w-[1040px] space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Week-1 프론트 스파이크</h1>
        <p className="mt-2 text-text-secondary">
          ChartContainer + form/wire 스키마 분리 + BFF fetch 래퍼 검증 페이지.
        </p>
      </header>

      <Card className="p-4">
        <div className="flex justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">시간별 발전량 (샘플)</h2>
            <p className="mt-1 text-sm text-text-muted">
              Organization: {generationQuery.data?.organizationId ?? DEMO_ORGANIZATION_ID}
            </p>
          </div>
          {generationQuery.isFetching && (
            <span className="text-sm text-text-muted">불러오는 중...</span>
          )}
        </div>

        {generationQuery.isError && (
          <p className="text-delta-bad">{formatError(generationQuery.error)}</p>
        )}

        <div className="mt-4">
          <ChartContainer
            option={chartOption}
            loading={generationQuery.isLoading}
            height={360}
            ariaLabel="시간별 태양광 발전량 라인 차트"
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">시뮬레이터 입력 (form/wire 분리 데모)</h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-end gap-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="capacityKw">설비용량 (kW)</Label>
            <Input id="capacityKw" {...register('capacityKw')} inputMode="decimal" />
            {errors.capacityKw && (
              <span className="text-xs text-delta-bad">{errors.capacityKw.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="performanceRatio">효율 (PR)</Label>
            <Input id="performanceRatio" {...register('performanceRatio')} inputMode="decimal" />
            {errors.performanceRatio && (
              <span className="text-xs text-delta-bad">{errors.performanceRatio.message}</span>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            변환
          </Button>
        </form>

        {submittedWire && (
          <div className="mt-4">
            <h3 className="text-base font-semibold">Wire payload (API body)</h3>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(submittedWire, null, 2)}
            </pre>
            <p className="mt-2 text-sm">
              일 발전량 추정: {formatNumber(dailyEstimateKwh)} kWh (가정 기반 시뮬레이션 — 실제 정산
              아님)
            </p>
          </div>
        )}
      </Card>
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
