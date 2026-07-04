import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SupplyController } from './supply.controller';
import { SupplyService } from './supply.service';

@Module({
  imports: [DbModule],
  controllers: [SupplyController],
  providers: [SupplyService],
})
export class SupplyModule {}
