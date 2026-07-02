import { z } from 'zod';

export const SpikeHourlyGenerationPointSchema = z.object({
  hour: z.string().regex(/^\d{2}:00$/),
  generationKwh: z.number().nonnegative(),
});
export type SpikeHourlyGenerationPoint = z.infer<typeof SpikeHourlyGenerationPointSchema>;

export const SpikeHourlyGenerationResponseSchema = z.object({
  organizationId: z.string().min(1),
  points: z.array(SpikeHourlyGenerationPointSchema),
});
export type SpikeHourlyGenerationResponse = z.infer<typeof SpikeHourlyGenerationResponseSchema>;

/**
 * §7.2 form/wire 스키마 분리 패턴. form schema는 입력 중 raw string(RHF가
 * 들고 있는 값), wire schema는 API 계약(number). 변환 함수는 스키마 옆
 * 한곳에만 둔다 — 한 스키마가 둘을 겸하면 string↔number 400 불일치가 난다.
 */
export const SimulatorFormSchema = z.object({
  capacityKw: z
    .string()
    .refine((value) => value.trim().length > 0, '설비용량을 입력하세요.')
    .refine(isPositiveNumberString, '0보다 큰 숫자를 입력하세요.'),
  performanceRatio: z
    .string()
    .refine((value) => value.trim().length > 0, '효율(PR)을 입력하세요.')
    .refine(isPerformanceRatioString, '0.50~1.00 사이 값을 입력하세요.'),
});
export type SimulatorFormValues = z.infer<typeof SimulatorFormSchema>;

export const SimulatorWireSchema = z.object({
  capacityKw: z.number().positive(),
  performanceRatio: z.number().min(0.5).max(1),
});
export type SimulatorWirePayload = z.infer<typeof SimulatorWireSchema>;

export function simulatorFormToWire(values: SimulatorFormValues): SimulatorWirePayload {
  return SimulatorWireSchema.parse({
    capacityKw: Number(values.capacityKw.trim()),
    performanceRatio: Number(values.performanceRatio.trim()),
  });
}

function isPositiveNumberString(value: string): boolean {
  const number = Number(value.trim());
  return Number.isFinite(number) && number > 0;
}

function isPerformanceRatioString(value: string): boolean {
  const number = Number(value.trim());
  return Number.isFinite(number) && number >= 0.5 && number <= 1;
}
