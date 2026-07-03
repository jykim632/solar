import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { GenerationModule } from './generation/generation.module';
import { HealthController } from './health.controller';
import { MeController } from './me.controller';
import { RecModule } from './rec/rec.module';

/**
 * Root module. §10/§15.3 error-envelope filter + 전역 default-deny
 * JwtAuthGuard(@Public opt-out). OrganizationGuard → PermissionGuard 체인은
 * solar-r32.2에서 이어진다.
 */
@Module({
  imports: [GenerationModule, RecModule],
  controllers: [HealthController, MeController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
