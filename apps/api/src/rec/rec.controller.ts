import { Controller, Get, Query } from '@nestjs/common';
import {
  RecDailyQuerySchema,
  type RecDailyQuery,
  type RecDailyResponse,
} from '@solar/api-contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RecService } from './rec.service';

/**
 * 공공데이터 endpoint — REC mart는 공공 집계값이라 organization_id
 * scope가 없다. 앱 접근 자체는 전역 JwtAuthGuard가 보호한다.
 */
@Controller('market/rec')
export class RecController {
  constructor(private readonly recService: RecService) {}

  @Get('daily')
  getDaily(
    @Query(new ZodValidationPipe(RecDailyQuerySchema)) query: RecDailyQuery,
  ): Promise<RecDailyResponse> {
    return this.recService.getDaily(query);
  }
}
