import { Controller, Get, Query } from '@nestjs/common';
import {
  SmpHourlyQuerySchema,
  type SmpHourlyQuery,
  type SmpHourlyResponse,
} from '@solar/api-contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SmpService } from './smp.service';

/**
 * 공공데이터 endpoint — SMP mart는 공공 집계값이라 organization_id
 * scope가 없다. 앱 접근 자체는 전역 JwtAuthGuard가 보호한다.
 */
@Controller('market/smp')
export class SmpController {
  constructor(private readonly smpService: SmpService) {}

  @Get('hourly')
  getHourly(
    @Query(new ZodValidationPipe(SmpHourlyQuerySchema)) query: SmpHourlyQuery,
  ): Promise<SmpHourlyResponse> {
    return this.smpService.getHourly(query);
  }
}
