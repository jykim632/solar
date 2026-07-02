import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { HealthController } from './health.controller';

/**
 * Root module. The §10/§15.3 error-envelope filter is wired here.
 * Guards (JwtAuthGuard → OrganizationGuard → PermissionGuard) remain solar-r32.2.
 */
@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
