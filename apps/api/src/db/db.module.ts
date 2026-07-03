import { Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { db, pool } from '@solar/db';

/**
 * @solar/db 공유 클라이언트를 Nest DI로 노출. 런타임은 pooled DATABASE_URL
 * (§18.4). 종료 시 pool을 닫는다 — main.ts의 enableShutdownHooks 필요.
 */
export const DB = Symbol('DB');

@Injectable()
class DbPoolShutdown implements OnApplicationShutdown {
  private static closed = false;

  async onApplicationShutdown(): Promise<void> {
    if (DbPoolShutdown.closed) {
      return;
    }

    DbPoolShutdown.closed = true;
    await pool.end();
  }
}

@Module({
  providers: [
    {
      provide: DB,
      useValue: db,
    },
    DbPoolShutdown,
  ],
  exports: [DB],
})
export class DbModule {}
