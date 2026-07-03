import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';

@Module({
  imports: [DbModule],
  controllers: [GenerationController],
  providers: [GenerationService],
})
export class GenerationModule {}
