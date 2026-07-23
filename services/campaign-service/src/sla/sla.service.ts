import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { CaseStatusEnum } from '@prisma/client';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  async checkSlaStatuses() {
    const now = new Date();

    // Henüz tamamlanmamış vakaları bul
    const activeCases = await this.prisma.optimizationCase.findMany({
      where: {
        status: {
          notIn: [CaseStatusEnum.TAMAMLANDI, CaseStatusEnum.YAYINDA, CaseStatusEnum.ARSIVLENDI],
        },
      },
    });

    let warningCount = 0;
    let breachCount = 0;

    for (const c of activeCases) {
      const totalTimeMs = c.slaDeadline.getTime() - c.createdAt.getTime();
      const elapsedTimeMs = now.getTime() - c.createdAt.getTime();
      const progressRatio = totalTimeMs > 0 ? elapsedTimeMs / totalTimeMs : 1.0;

      // 1. SLA %80 Uyarı kontrolü
      if (progressRatio >= 0.8 && !c.slaWarned && !c.slaBreached) {
        await this.prisma.optimizationCase.update({
          where: { id: c.id },
          data: { slaWarned: true },
        });
        warningCount++;

        await this.rabbitmq.publishEvent('sla.warning', {
          case_id: c.id,
          case_code: c.caseCode,
          campaign_id: c.campaignId,
          assigned_expert_id: c.assignedExpertId,
          priority: c.priority,
          sla_deadline: c.slaDeadline.toISOString(),
          elapsed_ratio: Number(progressRatio.toFixed(2)),
          timestamp: now.toISOString(),
        });
      }

      // 2. SLA İhlal (Breach) kontrolü
      if (now > c.slaDeadline && !c.slaBreached) {
        await this.prisma.optimizationCase.update({
          where: { id: c.id },
          data: { slaBreached: true },
        });
        breachCount++;

        await this.rabbitmq.publishEvent('sla.breached', {
          case_id: c.id,
          case_code: c.caseCode,
          campaign_id: c.campaignId,
          assigned_expert_id: c.assignedExpertId,
          priority: c.priority,
          sla_deadline: c.slaDeadline.toISOString(),
          breached_at: now.toISOString(),
          timestamp: now.toISOString(),
        });
      }
    }

    if (warningCount > 0 || breachCount > 0) {
      this.logger.log(`SLA Kontrolü: ${warningCount} yeni SLA uyarısı, ${breachCount} yeni SLA ihlali tespit edildi.`);
    }
  }
}
