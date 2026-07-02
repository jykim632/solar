import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const metadata: ArgumentMetadata = {
  type: 'query',
};

describe('ZodValidationPipe', () => {
  it('returns parsed input with z.infer-compatible types', () => {
    const QuerySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100),
      region: z.string().optional(),
    });
    type QueryDto = z.infer<typeof QuerySchema>;

    const pipe = new ZodValidationPipe(QuerySchema);
    const result: QueryDto = pipe.transform({ limit: '25', region: 'SEOUL' }, metadata);

    expect(result).toEqual({ limit: 25, region: 'SEOUL' });
  });

  it('throws BadRequestException with issue details for invalid input', () => {
    const QuerySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100),
    });
    const pipe = new ZodValidationPipe(QuerySchema);

    let caught: unknown;
    try {
      pipe.transform({ limit: '0' }, metadata);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual({
      message: 'Validation failed',
      details: [
        {
          path: 'limit',
          message: 'Too small: expected number to be >=1',
        },
      ],
    });
  });
});
