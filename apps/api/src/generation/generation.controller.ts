import { Controller, Get, Query } from '@nestjs/common';
import {
  GenerationHourlyQuerySchema,
  type GenerationHourlyQuery,
  type GenerationHourlyResponse,
} from '@solar/api-contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GenerationService } from './generation.service';

/**
 * 공공데이터 endpoint — mart 발전량은 공공 집계값이라 organization_id
 * scope가 없다. 앱 접근 자체는 전역 JwtAuthGuard가 보호한다.
 */
@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Get('hourly')
  getHourly(
    @Query(new ZodValidationPipe(GenerationHourlyQuerySchema)) query: GenerationHourlyQuery,
  ): Promise<GenerationHourlyResponse> {
    return this.generationService.getHourly(query);
  }
}
