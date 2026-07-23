import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { PointsService } from '../points/points.service.js';

@Injectable()
export class EventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(EventConsumerService.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly pointsService: PointsService,
  ) {}

  onModuleInit() {
    this.rabbitmq.registerMessageHandler(this.handleIncomingEvent.bind(this));
  }

  /** İki ISO zaman damgası arasındaki saat farkı; eksik/geçersizse null döner. */
  private calcDurationHours(createdAt?: string, completedAt?: string): number | null {
    if (!createdAt || !completedAt) return null;
    const start = new Date(createdAt).getTime();
    const end = new Date(completedAt).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;
    return (end - start) / 3600000;
  }

  async handleIncomingEvent(routingKey: string, data: any) {
    const eventId = data.event_id;
    const payload = data.payload || {};

    this.logger.log(`Gamification Event işleniyor [${routingKey}]: ${eventId}`);

    if (routingKey === 'campaign.optimized') {
      const expertId = payload.expert_id;
      const caseId = payload.case_id;
      const segment = payload.segment;
      const slaMet = payload.sla_met;
      const isKritik = payload.priority === 'KRITIK';
      const conversionTargetExceeded = payload.target_exceeded || payload.conversion_lift > 0.15;

      // Süre created_at → completed_at farkından hesaplanır (Case §6.1: 2 saatten kısa bonus).
      const durationHours = this.calcDurationHours(payload.created_at, payload.completed_at);

      if (expertId) {
        // 1. Optimizasyon tamamlandı (+10)
        await this.pointsService.addPoints(
          expertId,
          10,
          'OPTIMIZATION_COMPLETED',
          caseId,
          eventId ? `${eventId}-opt` : undefined,
          segment,
        );

        // 2. Hızlı optimizasyon bonusu (2 saatten kısa) (+5)
        if (durationHours !== null && durationHours < 2) {
          await this.pointsService.addPoints(
            expertId,
            5,
            'FAST_BONUS',
            caseId,
            eventId ? `${eventId}-fast` : undefined,
            segment,
          );
        }

        // 3. Dönüşüm hedefi aşıldı (+15)
        if (conversionTargetExceeded) {
          await this.pointsService.addPoints(
            expertId,
            15,
            'CONVERSION_TARGET_EXCEEDED',
            caseId,
            eventId ? `${eventId}-conv` : undefined,
            segment,
          );
        }

        // 4. KRITIK vaka SLA içinde tamamlandı (+15)
        if (isKritik && slaMet) {
          await this.pointsService.addPoints(
            expertId,
            15,
            'KRITIK_SLA_COMPLETED',
            caseId,
            eventId ? `${eventId}-kritik` : undefined,
            segment,
          );
        }
      }
    } else if (routingKey === 'sla.breached') {
      const expertId = payload.assigned_expert_id || payload.expert_id;
      const caseId = payload.case_id;

      if (expertId) {
        // SLA aşımı (-5)
        await this.pointsService.addPoints(
          expertId,
          -5,
          'SLA_EXCEEDED',
          caseId,
          eventId ? `${eventId}-breach` : undefined,
        );
      }
    } else if (routingKey === 'subscriber.feedback.submitted') {
      const expertId = payload.expert_id;
      const rating = payload.rating;

      if (expertId && rating !== undefined) {
        if (rating >= 4) {
          await this.pointsService.addPoints(
            expertId,
            3,
            'HIGH_RATING',
            payload.campaign_id,
            eventId ? `${eventId}-rating` : undefined,
          );
        } else if (rating <= 2) {
          // Abone düşük puan verdi (-3)
          await this.pointsService.addPoints(
            expertId,
            -3,
            'LOW_RATING',
            payload.campaign_id,
            eventId ? `${eventId}-rating` : undefined,
          );
        }
      }
    }
  }
}
