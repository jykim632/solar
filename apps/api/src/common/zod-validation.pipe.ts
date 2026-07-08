import { BadRequestException, Injectable } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { zodErrorToApiErrorDetails } from './zod-error-details';

/** Route-scoped Zod validation pipe for query/path/body inputs (§10, §15.3). */
@Injectable()
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<unknown, z.infer<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<TSchema> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: zodErrorToApiErrorDetails(result.error),
      });
    }

    return result.data;
  }
}
