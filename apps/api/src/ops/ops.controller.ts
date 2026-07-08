import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  OpsDatasourceUpdateBodySchema,
  OpsIngestionTriggerBodySchema,
  OpsRunsQuerySchema,
  type OpsDatasourceItem,
  type OpsDatasourceUpdateBody,
  type OpsDatasourcesResponse,
  type OpsIngestionTriggerBody,
  type OpsIngestionTriggerResponse,
  type OpsRunsQuery,
  type OpsRunsResponse,
} from '@solar/api-contracts';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OpsService } from './ops.service';

const DatasourceIdParamSchema = z.coerce.number().int().positive();

/**
 * 수집 관리 endpoint (solar-up3). ops 테이블은 공공데이터 수집 이력이라
 * organization scope 없음 — 앱 접근은 전역 JwtAuthGuard가 보호한다.
 * platform_admin role 체크는 PoC 단계(§10.4 이연)에서 PermissionGuard로 붙인다.
 */
@Controller('ops')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('datasources')
  getDatasources(): Promise<OpsDatasourcesResponse> {
    return this.opsService.getDatasources();
  }

  @Patch('datasources/:id')
  updateDatasource(
    @Param('id', new ZodValidationPipe(DatasourceIdParamSchema)) id: number,
    @Body(new ZodValidationPipe(OpsDatasourceUpdateBodySchema)) body: OpsDatasourceUpdateBody,
  ): Promise<OpsDatasourceItem> {
    return this.opsService.updateDatasource(id, body);
  }

  @Get('runs')
  getRuns(
    @Query(new ZodValidationPipe(OpsRunsQuerySchema)) query: OpsRunsQuery,
  ): Promise<OpsRunsResponse> {
    return this.opsService.getRuns(query);
  }

  @Post('ingestions')
  triggerIngestion(
    @Body(new ZodValidationPipe(OpsIngestionTriggerBodySchema)) body: OpsIngestionTriggerBody,
  ): Promise<OpsIngestionTriggerResponse> {
    return this.opsService.triggerIngestion(body);
  }
}
