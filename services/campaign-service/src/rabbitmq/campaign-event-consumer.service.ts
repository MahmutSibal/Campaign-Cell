import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CampaignStatusEnum, CaseStatusEnum, AssignedByEnum } from '@prisma/client';

@Injectable()
export class CampaignEventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(CampaignEventConsumerService.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.rabbitmq.registerMessageHandler(this.handleIncomingEvent.bind(this));
  }

  async handleIncomingEvent(routingKey: string, data: any) {
    const payload = data.payload || {};
    this.logger.log(`Campaign Service AI Event alıyor [${routingKey}]: ${data.event_id}`);

    if (routingKey === 'ai.prediction.created') {
      await this.handleAiPredictionCreated(payload);
    } else if (routingKey === 'ai.service.recovered') {
      await this.handleAiServiceRecovered();
    }
  }

  private async handleAiPredictionCreated(payload: any) {
    const campaignId = payload.campaign_id;
    const caseId = payload.case_id;

    if (campaignId) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          aiRecommendationScore: payload.recommendation_score,
          aiConversionProbability: payload.conversion_probability,
          status: CampaignStatusEnum.ACTIVE,
        },
      });
    }

    if (caseId) {
      const optCase = await this.prisma.optimizationCase.findUnique({
        where: { id: caseId },
      });

      if (optCase) {
        const updateData: any = {
          aiScore: payload.recommendation_score,
          aiConversionProb: payload.conversion_probability,
          aiReasoning: payload.reasoning,
        };

        if (payload.predicted_segment) {
          updateData.segment = payload.predicted_segment;
        }

        // Otomatik AI Uzman Önerisi ve Ataması (yalnızca geçerli UUID uzman id'si)
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (payload.recommended_expert_id && UUID_RE.test(payload.recommended_expert_id) && !optCase.assignedExpertId) {
          updateData.assignedExpertId = payload.recommended_expert_id;
          updateData.assignedAt = new Date();
          updateData.status = CaseStatusEnum.ATANDI;

          await this.prisma.campaignAssignment.create({
            data: {
              caseId,
              expertId: payload.recommended_expert_id,
              assignedBy: AssignedByEnum.AI,
              assignmentScore: payload.recommendation_score || 0.85,
            },
          });
        }

        await this.prisma.optimizationCase.update({
          where: { id: caseId },
          data: updateData,
        });

        this.logger.log(`Vaka [${caseId}] AI tahmin verileriyle başarıyla güncellendi.`);
      }
    }
  }

  private async handleAiServiceRecovered() {
    this.logger.log('AI Service kurtarma uyarısı alındı. Bekleyen kampanyalar yeniden analize gönderiliyor...');

    const pendingCampaigns = await this.prisma.campaign.findMany({
      where: { status: CampaignStatusEnum.MANUAL_OPTIMIZATION_REQUIRED },
      include: { optimizationCases: true },
    });

    this.logger.log(`${pendingCampaigns.length} adet beklemedeki kampanya yeniden AI servisine gönderiliyor.`);

    for (const c of pendingCampaigns) {
      const optCase = c.optimizationCases[0];
      await this.rabbitmq.publishEvent('campaign.created', {
        campaign_id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        target_segment: c.targetSegment,
        case_id: optCase ? optCase.id : null,
        recovered_reanalysis: true,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
