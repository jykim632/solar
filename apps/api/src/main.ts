import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env, EnvValidationError, formatEnvValidationDetails } from './config/env';
import type { ApiEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const apiEnv = loadEnvOrExit();
  const app = await NestFactory.create(AppModule);
  // All routes under /api/v1 (developer_plan.md §10). Auth routes live in apps/web.
  app.setGlobalPrefix('api/v1');
  await app.listen(apiEnv.PORT);
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${apiEnv.PORT}/api/v1`);
}

function loadEnvOrExit(): ApiEnv {
  try {
    return env();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      process.stderr.write(`[api] invalid environment\n${formatEnvValidationDetails(error.details)}\n`);
      process.exit(1);
    }

    throw error;
  }
}

void bootstrap();
