import { eq, and, sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { db } from '../db/client';
import { userBadgesTable, badgesTable, pointsTransactionsTable } from '../db/schema';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPublisher = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });

interface GameProfile {
  userId: string;
  completedCases: number;
  fastCompletions: number;
  conversionTargetHits: number;
  churnCasesResolved: number;
  totalPoints: number;
}

async function hasEarnedBadge(userId: string, badgeId: string): Promise<boolean> {
  const [row] = await db.select().from(userBadgesTable).where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badgeId))).limit(1);
  return !!row;
}

async function awardBadge(userId: string, badgeId: string): Promise<void> {
  await db.insert(userBadgesTable).values({ userId, badgeId }).onConflictDoNothing();
}

async function todayCompletions(userId: string): Promise<number> {
  const [row] = await db.select({ cnt: sql<number>`count(*)` }).from(pointsTransactionsTable)
    .where(and(eq(pointsTransactionsTable.userId, userId), sql`created_at >= NOW() - INTERVAL '24 hours'`, sql`points = 10`));
  return Number(row?.cnt || 0);
}

export async function checkAndAwardBadges(userId: string, profile: GameProfile): Promise<string[]> {
  const earned: string[] = [];

  async function check(badgeId: string, condition: boolean | (() => Promise<boolean>)) {
    const cond = typeof condition === 'function' ? await condition() : condition;
    if (cond && !(await hasEarnedBadge(userId, badgeId))) {
      await awardBadge(userId, badgeId);
      earned.push(badgeId);
      // Publish for SSE clients
      const [badge] = await db.select().from(badgesTable).where(eq(badgesTable.id, badgeId)).limit(1);
      redisPublisher.publish('badge.earned', JSON.stringify({
        userId,
        badgeId,
        badgeName: badge?.name || badgeId,
        badgeDescription: badge?.description || '',
        earnedAt: new Date().toISOString(),
      })).catch(() => {});
    }
  }

  await check('ilk-kampanya', profile.completedCases >= 1);
  await check('hiz-ustasi', profile.fastCompletions >= 10);
  await check('donusum-krali', profile.conversionTargetHits >= 10);
  await check('maratoncu', async () => (await todayCompletions(userId)) >= 20);
  await check('churn-avcisi', profile.churnCasesResolved >= 10);
  await check('uzman', profile.completedCases >= 50);

  return earned;
}
