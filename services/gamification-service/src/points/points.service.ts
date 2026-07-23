import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { BadgesService } from '../badges/badges.service.js';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
    @Inject(forwardRef(() => BadgesService))
    private readonly badgesService: BadgesService,
  ) {}

  async addPoints(
    expertId: string,
    points: number,
    reason: string,
    caseId?: string,
    eventId?: string,
    segment?: string,
  ) {
    if (!expertId) {
      this.logger.warn(`Uzman ID geçersiz, puan eklenemedi.`);
      return null;
    }

    // 1. Idempotency (Yinelemesizlik) Kontrolü
    if (eventId) {
      const existing = await this.prisma.pointsTransaction.findUnique({
        where: { eventId },
      });
      if (existing) {
        this.logger.log(`Event [${eventId}] daha önce işlenmiş. Mükerrer puan eklenmedi.`);
        return existing;
      }
    }

    // 2. Puan İşlemini Kaydet
    const transaction = await this.prisma.pointsTransaction.create({
      data: {
        expertId,
        caseId: caseId || null,
        points,
        reason,
        segment: segment || null,
        eventId: eventId || null,
      },
    });

    // 3. Toplam Puanı Hesapla
    const aggregate = await this.prisma.pointsTransaction.aggregate({
      where: { expertId },
      _sum: { points: true },
    });
    const totalPoints = aggregate._sum.points || 0;

    // 4. Seviye Kontrolü
    const levelInfo = await this.determineLevel(totalPoints);

    // 5. RabbitMQ Event Fırlat
    await this.rabbitmq.publishEvent('points.awarded', {
      expert_id: expertId,
      points_added: points,
      reason,
      total_points: totalPoints,
      current_level: levelInfo.currentLevel,
      timestamp: new Date().toISOString(),
    });

    // 6. Otomatik Rozet Değerlendirmesi
    await this.badgesService.evaluateBadges(expertId, totalPoints);

    return transaction;
  }

  async determineLevel(totalPoints: number) {
    const levels = await this.prisma.level.findMany({
      orderBy: { minPoints: 'asc' },
    });

    let currentLevel = 'Bronz';
    let nextLevel: string | null = 'Gümüş';
    let nextLevelMinPoints: number | null = 500;

    for (let i = 0; i < levels.length; i++) {
      const lvl = levels[i];
      if (totalPoints >= lvl.minPoints && (lvl.maxPoints === null || totalPoints <= lvl.maxPoints)) {
        currentLevel = lvl.name;
        if (i + 1 < levels.length) {
          nextLevel = levels[i + 1].name;
          nextLevelMinPoints = levels[i + 1].minPoints;
        } else {
          nextLevel = null;
          nextLevelMinPoints = null;
        }
        break;
      }
    }

    let progressPercentage = 100;
    if (nextLevelMinPoints !== null) {
      const currentLevelMin = levels.find((l) => l.name === currentLevel)?.minPoints || 0;
      const range = nextLevelMinPoints - currentLevelMin;
      const progress = totalPoints - currentLevelMin;
      progressPercentage = Math.min(Math.max(Math.round((progress / range) * 100), 0), 100);
    }

    return {
      currentLevel,
      nextLevel,
      nextLevelMinPoints,
      progressPercentage,
    };
  }

  async getExpertPoints(expertId: string) {
    const aggregate = await this.prisma.pointsTransaction.aggregate({
      where: { expertId },
      _sum: { points: true },
    });
    const totalPoints = aggregate._sum.points || 0;

    const levelInfo = await this.determineLevel(totalPoints);

    const transactions = await this.prisma.pointsTransaction.findMany({
      where: { expertId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      expertId,
      totalPoints,
      currentLevel: levelInfo.currentLevel,
      nextLevel: levelInfo.nextLevel,
      nextLevelMinPoints: levelInfo.nextLevelMinPoints,
      progressPercentage: levelInfo.progressPercentage,
      recentTransactions: transactions,
    };
  }
}
