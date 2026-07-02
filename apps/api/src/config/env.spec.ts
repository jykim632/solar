import { describe, expect, it } from 'vitest';
import { EnvValidationError, validateEnv } from './env';

describe('validateEnv', () => {
  it('fails when required environment variables are missing', () => {
    let caught: unknown;

    try {
      validateEnv({});
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvValidationError);
    expect((caught as EnvValidationError).details.map((detail) => detail.path)).toEqual([
      'DATABASE_URL',
      'AUTH_BASE_URL',
    ]);
  });

  it('parses valid environment variables and applies defaults', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgres://user:pass@example.com:5432/solar?sslmode=require',
      AUTH_BASE_URL: 'http://localhost:3000',
    });

    expect(parsed).toEqual({
      PORT: 4000,
      DATABASE_URL: 'postgres://user:pass@example.com:5432/solar?sslmode=require',
      AUTH_BASE_URL: 'http://localhost:3000',
    });
  });
});
