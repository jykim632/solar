import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { RecController } from './rec.controller';
import { RecService } from './rec.service';

@Module({
  imports: [DbModule],
  controllers: [RecController],
  providers: [RecService],
})
export class RecModule {}
