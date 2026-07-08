import { z } from 'zod';
import { IsoInstantSchema } from './generation';

/**
 * /api/v1/ops/* 계약 (solar-up3) — 수집 관리 화면용.
 * datasource 목록+kill switch 토글, 최근 ops_ingestion_run, 수동 실행 트리거.
 * bigint PK(ops_ingestion_run.id)는 JSON 직렬화 불가라 string으로 노출한다.
 */
export const IngestionRunStatusSchema = z.enum(['running', 'success', 'failed', 'partial']);
export type IngestionRunStatus = z.infer<typeof IngestionRunStatusSchema>;

/** run별 quality check 집계 (ops_data_quality_check.status별 건수). */
export const QualityCountsSchema = z.object({
  pass: z.number().int().min(0),
  warn: z.number().int().min(0),
  fail: z.number().int().min(0),
});
export type QualityCounts = z.infer<typeof QualityCountsSchema>;

export const OpsRunSummarySchema = z.object({
  id: z.string(),
  status: IngestionRunStatusSchema,
  startedAt: IsoInstantSchema,
  finishedAt: IsoInstantSchema.nullable(),
  rowCount: z.number().int().nullable(),
  quality: QualityCountsSchema,
});
export type OpsRunSummary = z.infer<typeof OpsRunSummarySchema>;

export const OpsDatasourceItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  provider: z.string(),
  sourceType: z.string(),
  updateCycle: z.string().nullable(),
  enabled: z.boolean(),
  lastRun: OpsRunSummarySchema.nullable(),
});
export type OpsDatasourceItem = z.infer<typeof OpsDatasourceItemSchema>;

export const OpsDatasourcesResponseSchema = z.object({
  items: z.array(OpsDatasourceItemSchema),
});
export type OpsDatasourcesResponse = z.infer<typeof OpsDatasourcesResponseSchema>;

export const OpsDatasourceUpdateBodySchema = z.object({
  enabled: z.boolean(),
});
export type OpsDatasourceUpdateBody = z.infer<typeof OpsDatasourceUpdateBodySchema>;

export const OpsRunsQuerySchema = z.object({
  datasource: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type OpsRunsQuery = z.infer<typeof OpsRunsQuerySchema>;

export const OpsRunItemSchema = z.object({
  id: z.string(),
  datasource: z.string(),
  status: IngestionRunStatusSchema,
  startedAt: IsoInstantSchema,
  finishedAt: IsoInstantSchema.nullable(),
  requestedFrom: IsoInstantSchema.nullable(),
  requestedTo: IsoInstantSchema.nullable(),
  rowCount: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  quality: QualityCountsSchema,
});
export type OpsRunItem = z.infer<typeof OpsRunItemSchema>;

export const OpsRunsResponseSchema = z.object({
  items: z.array(OpsRunItemSchema),
});
export type OpsRunsResponse = z.infer<typeof OpsRunsResponseSchema>;

/** from/to는 worker CLI와 동일한 KST YYYYMMDD (미지정 시 어제 하루). */
export const OpsIngestionTriggerBodySchema = z.object({
  datasource: z.string().trim().min(1).max(64),
  from: z.string().regex(/^\d{8}$/, 'expected YYYYMMDD').optional(),
  to: z.string().regex(/^\d{8}$/, 'expected YYYYMMDD').optional(),
});
export type OpsIngestionTriggerBody = z.infer<typeof OpsIngestionTriggerBodySchema>;

export const OpsIngestionTriggerResponseSchema = z.object({
  ingestionRunId: z.string(),
  datasource: z.string(),
  status: IngestionRunStatusSchema.exclude(['running']),
  rowCount: z.number().int(),
  successfulIntervals: z.number().int(),
  failedIntervals: z.number().int(),
  errorMessage: z.string().optional(),
});
export type OpsIngestionTriggerResponse = z.infer<typeof OpsIngestionTriggerResponseSchema>;
