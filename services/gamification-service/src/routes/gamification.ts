import { Router, Response } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { gamificationProfilesTable, pointsTransactionsTable, badgesTable, userBadgesTable } from '../db/schema';
import { AuthRequest, requireAuth } from '../middleware/requireAuth';

const router = Router();

// GET /v1/game/leaderboard?period=weekly|daily
router.get('/leaderboard', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const period = String(req.query.period || 'weekly');
  const interval = period === 'daily' ? '24 hours' : '7 days';

  const rows = await db.select({
    userId: pointsTransactionsTable.userId,
    periodPoints: sql<number>`SUM(points)`,
  }).from(pointsTransactionsTable)
    .where(sql`created_at >= NOW() - INTERVAL ${sql.raw(`'${interval}'`)}`)
    .groupBy(pointsTransactionsTable.userId)
    .orderBy(desc(sql`SUM(points)`))
    .limit(10);

  const entries = await Promise.all(rows.map(async (r, i) => {
    const [profile] = await db.select().from(gamificationProfilesTable)
      .where(eq(gamificationProfilesTable.userId, r.userId)).limit(1);
    return {
      rank: i + 1,
      userId: r.userId,
      userName: profile?.userName || r.userId,
      periodPoints: Number(r.periodPoints),
      totalPoints: profile?.totalPoints || 0,
      level: profile?.level || 'BRONZ',
    };
  }));

  res.json({ success: true, data: { period, entries } });
});

// GET /v1/game/profile/:userId
router.get('/profile/:userId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = String(req.params.userId);

  const [profile] = await db.select().from(gamificationProfilesTable)
    .where(eq(gamificationProfilesTable.userId, userId)).limit(1);
  if (!profile) { res.status(404).json({ error: 'Profil bulunamadı' }); return; }

  // Badges
  const userBadges = await db.select({ badge: badgesTable, earnedAt: userBadgesTable.earnedAt })
    .from(userBadgesTable)
    .leftJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(eq(userBadgesTable.userId, userId));

  const badges = userBadges.map(b => ({ ...b.badge, earnedAt: b.earnedAt }));

  // Compute rank by fetching all users sorted by period points and finding position
  const dailyAll = await db.select({
    userId: pointsTransactionsTable.userId,
    pts: sql<number>`SUM(points)`,
  }).from(pointsTransactionsTable)
    .where(sql`created_at >= NOW() - INTERVAL '24 hours'`)
    .groupBy(pointsTransactionsTable.userId)
    .orderBy(desc(sql`SUM(points)`));

  const weeklyAll = await db.select({
    userId: pointsTransactionsTable.userId,
    pts: sql<number>`SUM(points)`,
  }).from(pointsTransactionsTable)
    .where(sql`created_at >= NOW() - INTERVAL '7 days'`)
    .groupBy(pointsTransactionsTable.userId)
    .orderBy(desc(sql`SUM(points)`));

  const dailyRankIdx = dailyAll.findIndex(r => r.userId === userId);
  const weeklyRankIdx = weeklyAll.findIndex(r => r.userId === userId);

  res.json({ success: true, data: {
    ...profile,
    badges,
    dailyRank: dailyRankIdx >= 0 ? dailyRankIdx + 1 : null,
    weeklyRank: weeklyRankIdx >= 0 ? weeklyRankIdx + 1 : null,
  }});
});

// GET /v1/game/badges
router.get('/badges', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const badges = await db.select().from(badgesTable);
  res.json({ success: true, data: badges });
});

// GET /v1/game/points-history/:userId
router.get('/points-history/:userId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const txs = await db.select().from(pointsTransactionsTable)
    .where(eq(pointsTransactionsTable.userId, userId))
    .orderBy(desc(pointsTransactionsTable.createdAt)).limit(50);
  res.json({ success: true, data: txs });
});

export default router;
