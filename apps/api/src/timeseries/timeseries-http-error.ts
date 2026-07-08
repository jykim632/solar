import { BadRequestException } from '@nestjs/common';
import type { ApiErrorDetail } from '@solar/api-contracts';
import { TimeseriesQueryError } from './timeseries-query-error';

/** TimeseriesQueryError → 400 (기존 에러 envelope 형식과 정합). */
export function throwTimeseriesBadRequest(error: unknown): never {
  if (error instanceof TimeseriesQueryError) {
    const details: ApiErrorDetail[] = [{ path: error.path, message: error.message }];
    throw new BadRequestException({ message: error.message, details });
  }

  throw error;
}
