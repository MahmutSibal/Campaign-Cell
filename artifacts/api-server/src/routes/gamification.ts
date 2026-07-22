import { Router } from "express";
import { eq, desc, asc, count } from "drizzle-orm";
import { db, gamificationProfilesTable, pointsTransactionsTable, badgesTable, userBadgesTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

// Leaderboard
router.get("/v1/game/leaderboard", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const period = String(req.query.period || "weekly");
  const profiles = await db.select({
    profile: gamificationProfilesTable,
    user: { id: usersTable.id, name: usersTable.name },
  }).from(gamificationProfilesTable)
    .leftJoin(usersTable, eq(gamificationProfilesTable.userId, usersTable.id))
    .orderBy(desc(gamificationProfilesTable.totalPoints))
    .limit(10);

  const entries = profiles.map((p, i) => ({
    rank: i + 1,
    userId: p.profile.userId,
    name: p.user?.name ?? "Unknown",
    points: p.profile.totalPoints,
    level: p.profile.level,
    completedCases: p.profile.completedCases,
    badges: 0, // simplified
  }));

  res.json({ period, entries });
});

// Game profile
router.get("/v1/game/profile/:userId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const [profile] = await db.select().from(gamificationProfilesTable).where(eq(gamificationProfilesTable.userId, userId)).limit(1);
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const userBadges = await db.select({ badge: badgesTable, ub: userBadgesTable })
    .from(userBadgesTable)
    .leftJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(eq(userBadgesTable.userId, userId));

  const allProfiles = await db.select().from(gamificationProfilesTable).orderBy(desc(gamificationProfilesTable.totalPoints));
  const rank = allProfiles.findIndex(p => p.userId === userId) + 1;

  if (!profile) {
    res.status(404).json({ error: "Game profile not found" }); return;
  }

  res.json({
    userId: profile.userId,
    name: user?.name ?? "Unknown",
    totalPoints: profile.totalPoints,
    level: profile.level,
    rank,
    dailyRank: rank,
    weeklyRank: rank,
    badges: userBadges.filter(ub => ub.badge).map(ub => ({
      id: ub.badge!.id,
      name: ub.badge!.name,
      description: ub.badge!.description,
      icon: ub.badge!.icon,
      requirement: ub.badge!.requirement,
      earnedAt: ub.ub.earnedAt?.toISOString() ?? null,
    })),
    completedCases: profile.completedCases,
    averagePerformance: profile.completedCases > 0 ? Math.min(1, profile.totalPoints / (profile.completedCases * 15)) : 0,
  });
});

// List badges
router.get("/v1/game/badges", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const badges = await db.select().from(badgesTable).orderBy(asc(badgesTable.name));
  res.json({
    data: badges.map(b => ({
      id: b.id, name: b.name, description: b.description, icon: b.icon, requirement: b.requirement, earnedAt: null,
    }))
  });
});

// Points history
router.get("/v1/game/points-history/:userId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const transactions = await db.select().from(pointsTransactionsTable).where(eq(pointsTransactionsTable.userId, userId)).orderBy(desc(pointsTransactionsTable.createdAt)).limit(50);
  const total = transactions.reduce((sum, t) => sum + t.points, 0);
  res.json({
    data: transactions.map(t => ({ id: t.id, userId: t.userId, points: t.points, reason: t.reason, caseId: t.caseId ?? null, createdAt: t.createdAt?.toISOString() })),
    totalPoints: total,
  });
});

export default router;
