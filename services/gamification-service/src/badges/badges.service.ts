import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  async awardBadge(expertId: string, badgeCode: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { code: badgeCode },
    });

    if (!badge) return null;

    // Uzman bu rozete zaten sahip mi?
    const existing = await this.prisma.userBadge.findUnique({
      where: {
        expertId_badgeId: {
          expertId,
          badgeId: badge.id,
        },
      },
    });

    if (existing) return existing;

    const userBadge = await this.prisma.userBadge.create({
      data: {
        expertId,
        badgeId: badge.id,
      },
      include: { badge: true },
    });

    this.logger.log(`Tebrikler! Uzman [${expertId}] '${badge.name}' (${badge.code}) rozetini kazandı.`);

    // RabbitMQ Event
    await this.rabbitmq.publishEvent('badge.earned', {
      expert_id: expertId,
      badge_code: badge.code,
      badge_name: badge.name,
      badge_description: badge.description,
      earned_at: userBadge.earnedAt.toISOString(),
    });

    return userBadge;
  }

  /**
   * Rozet koşullarını Case §6.2'ye birebir uygun değerlendirir.
   * Koşullar OPTIMIZATION_COMPLETED işlemleri üzerinden hesaplanır (her tamamlama = 1 optimizasyon).
   */
  async evaluateBadges(expertId: string, _totalPoints?: number) {
    const transactions = await this.prisma.pointsTransaction.findMany({
      where: { expertId },
    });

    const completed = transactions.filter((t) => t.reason === 'OPTIMIZATION_COMPLETED');
    const completedCount = completed.length;
    const fastBonusCount = transactions.filter((t) => t.reason === 'FAST_BONUS').length;
    const conversionCount = transactions.filter((t) => t.reason === 'CONVERSION_TARGET_EXCEEDED').length;

    // 1. ILK_KAMPANYA — İlk optimizasyonu tamamlama
    if (completedCount >= 1) {
      await this.awardBadge(expertId, 'ILK_KAMPANYA');
    }

    // 2. HIZ_USTASI — 2 saatin altında 10 optimizasyon (FAST_BONUS = <2 saat tamamlama)
    if (fastBonusCount >= 10) {
      await this.awardBadge(expertId, 'HIZ_USTASI');
    }

    // 3. DONUSUM_KRALI — 10 kampanyada dönüşüm hedefi aşımı
    if (conversionCount >= 10) {
      await this.awardBadge(expertId, 'DONUSUM_KRALI');
    }

    // 4. MARATONCU — Bir günde 20 optimizasyon (takvim gününe göre grupla)
    if (this.maxCompletionsInSingleDay(completed) >= 20) {
      await this.awardBadge(expertId, 'MARATONCU');
    }

    // 5. CHURN_AVCISI — 10 RISKLI_KAYIP vakayı kurtarma (segment bazlı)
    const churnRescued = completed.filter((t) => t.segment === 'RISKLI_KAYIP').length;
    if (churnRescued >= 10) {
      await this.awardBadge(expertId, 'CHURN_AVCISI');
    }

    // 6. UZMAN — Tek segmentte 50 optimizasyon
    if (this.maxCompletionsInSingleSegment(completed) >= 50) {
      await this.awardBadge(expertId, 'UZMAN');
    }
  }

  /** Aynı takvim günü (UTC) içinde tamamlanan en yüksek optimizasyon sayısı. */
  private maxCompletionsInSingleDay(completed: { createdAt: Date }[]): number {
    const byDay = new Map<string, number>();
    for (const t of completed) {
      const day = new Date(t.createdAt).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    return byDay.size ? Math.max(...byDay.values()) : 0;
  }

  /** Tek bir segmentte tamamlanan en yüksek optimizasyon sayısı. */
  private maxCompletionsInSingleSegment(completed: { segment: string | null }[]): number {
    const bySegment = new Map<string, number>();
    for (const t of completed) {
      if (!t.segment) continue;
      bySegment.set(t.segment, (bySegment.get(t.segment) || 0) + 1);
    }
    return bySegment.size ? Math.max(...bySegment.values()) : 0;
  }

  async getExpertBadges(expertId: string) {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { expertId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });

    const allBadges = await this.prisma.badge.findMany();

    const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));
    const badgeProgress = allBadges.map((b) => ({
      badgeId: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      isEarned: earnedBadgeIds.has(b.id),
      earnedAt: userBadges.find((ub) => ub.badgeId === b.id)?.earnedAt || null,
    }));

    return {
      expertId,
      earnedCount: userBadges.length,
      totalBadgesCount: allBadges.length,
      badges: badgeProgress,
    };
  }
}
