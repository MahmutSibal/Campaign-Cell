import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaService } from './sla.service.js';
import { SlaCronService } from './sla-cron.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SlaService, SlaCronService],
  exports: [SlaService],
})
export class SlaModule {}
