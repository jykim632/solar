import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Root module. Guards (JwtAuthGuard → OrganizationGuard → PermissionGuard),
 * the global ZodValidationPipe, and the error-envelope exception filter are
 * wired in solar-8wv.14 / solar-r32.2. This is the bootable skeleton.
 */
@Module({
  controllers: [HealthController],
})
export class AppModule {}
