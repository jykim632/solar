import { Controller, Get, Query } from '@nestjs/common';
import {
  SupplyRealtimeQuerySchema,
  type SupplyRealtimeQuery,
  type SupplyRealtimeResponse,
} from '@solar/api-contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SupplyService } from './supply.service';

/**
 * 공공데이터 endpoint — 전력수급 mart는 공공 집계값이라 organization_id
 * scope가 없다. 앱 접근 자체는 전역 JwtAuthGuard가 보호한다.
 */
@Controller('supply')
export class SupplyController {
  constructor(private readonly supplyService: SupplyService) {}

  @Get('realtime')
  getRealtime(
    @Query(new ZodValidationPipe(SupplyRealtimeQuerySchema)) query: SupplyRealtimeQuery,
  ): Promise<SupplyRealtimeResponse> {
    return this.supplyService.getRealtime(query);
  }
}
