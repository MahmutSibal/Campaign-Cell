import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { CreateFeedbackDto } from './dto/create-feedback.dto.js';
import { CreateAbTestDto } from './dto/create-ab-test.dto.js';
import { FeedbackResponseEnum } from '@prisma/client';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  /**
   * Kampanyayı optimize eden uzmanın id'sini bulur (gamification puanı için).
   */
  private async findResponsibleExpert(campaignId: string): Promise<string | null> {
    const optCase = await this.prisma.optimizationCase.findFirst({
      where: { campaignId, assignedExpertId: { not: null } },
      orderBy: { assignedAt: 'desc' },
      select: { assignedExpertId: true },
    });
    return optCase?.assignedExpertId ?? null;
  }

  async createFeedback(dto: CreateFeedbackDto, subscriberId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Kampanya bulunamadı (ID: ${dto.campaignId})`);
    }

    // Case §4.6: Puanlama TEK SEFERLİKTİR. Aynı abone aynı kampanyayı yeniden puanlayamaz.
    if (dto.rating !== undefined) {
      const alreadyRated = await this.prisma.subscriberFeedback.findFirst({
        where: { campaignId: dto.campaignId, subscriberId, rating: { not: null } },
      });
      if (alreadyRated) {
        throw new ConflictException('Bu kampanya için değerlendirmenizi zaten verdiniz. Puanlama tek seferliktir.');
      }
    }

    const feedback = await this.prisma.subscriberFeedback.create({
      data: {
        campaignId: dto.campaignId,
        subscriberId,
        response: dto.response,
        rejectionReason: dto.rejectionReason,
        rating: dto.rating,
      },
    });

    const expertId = await this.findResponsibleExpert(dto.campaignId);

    // Case §4.5: Kabul/İlgilenmiyorum yanıtı dönüşüm verisine işlenir.
    const eventType = dto.response === FeedbackResponseEnum.ACCEPTED ? 'subscriber.offer.accepted' : 'subscriber.offer.rejected';
    await this.rabbitmq.publishEvent(eventType, {
      feedback_id: feedback.id,
      campaign_id: dto.campaignId,
      campaign_code: campaign.code,
      campaign_type: campaign.type, // Case §4.5: benzer (aynı tip) kampanya skorunu düşürmek için
      target_segment: campaign.targetSegment,
      subscriber_id: subscriberId,
      expert_id: expertId,
      response: dto.response,
      rejection_reason: dto.rejectionReason,
      timestamp: feedback.createdAt.toISOString(),
    });

    // Case §4.6: Puan verildiğinde Gamification Service'e event (expert_id dahil → puanlama çalışır).
    if (dto.rating !== undefined) {
      await this.rabbitmq.publishEvent('subscriber.feedback.submitted', {
        feedback_id: feedback.id,
        campaign_id: dto.campaignId,
        campaign_code: campaign.code,
        subscriber_id: subscriberId,
        expert_id: expertId,
        rating: dto.rating,
        timestamp: feedback.createdAt.toISOString(),
      });
    }

    return feedback;
  }

  async createAbTest(dto: CreateAbTestDto, userId: string) {
    const optCase = await this.prisma.optimizationCase.findUnique({
      where: { id: dto.caseId },
    });

    if (!optCase) {
      throw new NotFoundException(`Optimizasyon vakası bulunamadı (ID: ${dto.caseId})`);
    }

    const abTest = await this.prisma.abTestExperiment.create({
      data: {
        caseId: dto.caseId,
        variantADesc: dto.variantADesc,
        variantBDesc: dto.variantBDesc,
        variantAConversion: dto.variantAConversion,
        variantBConversion: dto.variantBConversion,
        winner: dto.winner,
      },
    });

    return abTest;
  }
}
