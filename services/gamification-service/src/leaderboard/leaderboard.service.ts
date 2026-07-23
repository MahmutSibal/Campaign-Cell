import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PointsService } from '../points/points.service.js';

export enum LeaderboardPeriod {
  ALL_TIME = 'ALL_TIME',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  /**
   * Uzman id → ad eşlemesini Identity Service'ten çeker (liderlik/profilde UUID yerine isim gösterilir).
   * Erişilemezse boş harita döner ve UI id'ye düşer (servis bağımsızlığı korunur).
   */
  private async fetchExpertNames(): Promise<Map<string, string>> {
    const base = process.env.IDENTITY_SERVICE_URL || 'http://identity-service:3001';
    const map = new Map<string, string>();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${base}/internal/experts`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const body: any = await res.json();
        for (const e of body?.data ?? []) {
          if (e?.id && e?.name) map.set(e.id, e.name);
        }
      }
    } catch {
      // Identity erişilemez → isimsiz (id) devam.
    }
    return map;
  }

  async getLeaderboard(period: LeaderboardPeriod = LeaderboardPeriod.ALL_TIME) {
    const where: any = {};
    const now = new Date();

    if (period === LeaderboardPeriod.DAILY) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.createdAt = { gte: startOfDay };
    } else if (period === LeaderboardPeriod.WEEKLY) {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      where.createdAt = { gte: startOfWeek };
    }

    // Case §6.4: liderlik tablosu ilk 10 kişi, puan sıralı.
    const grouped = await this.prisma.pointsTransaction.groupBy({
      by: ['expertId'],
      where,
      _sum: {
        points: true,
      },
      orderBy: {
        _sum: {
          points: 'desc',
        },
      },
      take: 10,
    });

    const expertNames = await this.fetchExpertNames();

    const leaderboard = await Promise.all(
      grouped.map(async (item, index) => {
        const expertId = item.expertId;
        const totalPoints = item._sum.points || 0;
        const levelInfo = await this.pointsService.determineLevel(totalPoints);
        const badgesCount = await this.prisma.userBadge.count({ where: { expertId } });

        return {
          rank: index + 1,
          expertId,
          expertName: expertNames.get(expertId) || 'Uzman',
          totalPoints,
          level: levelInfo.currentLevel,
          earnedBadgesCount: badgesCount,
        };
      }),
    );

    return {
      period,
      generatedAt: now.toISOString(),
      leaderboard,
    };
  }
}
