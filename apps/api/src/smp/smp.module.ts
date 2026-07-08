import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SmpController } from './smp.controller';
import { SmpService } from './smp.service';

@Module({
  imports: [DbModule],
  controllers: [SmpController],
  providers: [SmpService],
})
export class SmpModule {}
