import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlaService } from './sla.service.js';

@Injectable()
export class SlaCronService {
  private readonly logger = new Logger(SlaCronService.name);

  constructor(private readonly slaService: SlaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSlaCheckCron() {
    try {
      await this.slaService.checkSlaStatuses();
    } catch (error) {
      this.logger.error('SLA Cron kontrolünde hata:', error);
    }
  }
}
