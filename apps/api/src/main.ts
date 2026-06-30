import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // All routes under /api/v1 (developer_plan.md §10). Auth routes live in apps/web.
  app.setGlobalPrefix('api/v1');
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
