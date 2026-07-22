import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { gamificationProfilesTable, pointsTransactionsTable } from '../db/schema';
import { calculateLevel } from './levelCalculator';
import { checkAndAwardBadges } from './badgeEngine';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

async function ensureProfile(userId: string, userName?: string): Promise<any> {
  const [existing] = await db.select().from(gamificationProfilesTable).where(eq(gamificationProfilesTable.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(gamificationProfilesTable).values({ userId, userName: userName || userId }).returning();
  return created;
}

async function addPoints(userId: string, points: number, reason: string, caseId?: string) {
  await db.insert(pointsTransactionsTable).values({ userId, points, reason, caseId });
}

async function updateProfile(userId: string, updates: Partial<{ totalPoints: number; level: string; completedCases: number; fastCompletions: number; conversionTargetHits: number; churnCasesResolved: number }>) {
  await db.update(gamificationProfilesTable).set({ ...updates, updatedAt: new Date() }).where(eq(gamificationProfilesTable.userId, userId));
}

export async function handleCampaignOptimized(event: {
  caseId: string; caseCode?: string; expertId: string; expertName?: string;
  segment?: string; priority?: string; conversionLift?: number; durationMinutes?: number;
}): Promise<void> {
  try {
    const profile = await ensureProfile(event.expertId, event.expertName);
    let earned = 0;

    // +10 base
    earned += 10;
    await addPoints(event.expertId, 10, `Vaka tamamlandı: ${event.caseCode || event.caseId}`, event.caseId);

    // +5 hızlı tamamlama (< 2 saat)
    const fast = (event.durationMinutes || 999) < 120;
    if (fast) {
      earned += 5;
      await addPoints(event.expertId, 5, 'Hızlı tamamlama bonusu (<2 saat)', event.caseId);
    }

    // +15 dönüşüm hedefi aşıldı
    const convHit = (event.conversionLift || 0) > 0.15;
    if (convHit) {
      earned += 15;
      await addPoints(event.expertId, 15, `Dönüşüm hedefi aşıldı (%${((event.conversionLift || 0) * 100).toFixed(0)} artış)`, event.caseId);
    }

    // +15 KRITIK SLA içinde
    if (event.priority === 'KRITIK' && fast) {
      earned += 15;
      await addPoints(event.expertId, 15, 'Kritik vaka SLA içinde tamamlandı', event.caseId);
    }

    const newPoints = (profile.totalPoints || 0) + earned;
    const newLevel = calculateLevel(newPoints);

    const profileUpdates: any = {
      totalPoints: newPoints,
      level: newLevel,
      completedCases: (profile.completedCases || 0) + 1,
    };
    if (fast) profileUpdates.fastCompletions = (profile.fastCompletions || 0) + 1;
    if (convHit) profileUpdates.conversionTargetHits = (profile.conversionTargetHits || 0) + 1;
    if (event.segment === 'RISKLI_KAYIP') profileUpdates.churnCasesResolved = (profile.churnCasesResolved || 0) + 1;

    await updateProfile(event.expertId, profileUpdates);

    const newProfile = { ...profile, ...profileUpdates };
    const newBadges = await checkAndAwardBadges(event.expertId, newProfile);
    if (newBadges.length > 0) {
      logger.info({ expertId: event.expertId, newBadges }, 'Badges earned!');
    }
  } catch (err) {
    logger.error({ err, event }, 'Error handling campaign.optimized event');
  }
}

export async function handleSlaBreached(event: { caseId: string; expertId?: string }): Promise<void> {
  if (!event.expertId) return;
  try {
    const profile = await ensureProfile(event.expertId);
    await addPoints(event.expertId, -5, `SLA aşımı: ${event.caseId}`, event.caseId);
    const newPoints = (profile.totalPoints || 0) - 5;
    await updateProfile(event.expertId, { totalPoints: newPoints, level: calculateLevel(newPoints) });
  } catch (err) {
    logger.error({ err, event }, 'Error handling campaign.sla_breached event');
  }
}

export async function handleOfferRated(event: { subscriberId?: string; campaignId?: string; rating?: number; expertId?: string }): Promise<void> {
  if (!event.expertId || !event.rating || event.rating > 2) return;
  try {
    const profile = await ensureProfile(event.expertId);
    await addPoints(event.expertId, -3, `Abone düşük puan verdi (${event.rating}/5)`, event.campaignId);
    const newPoints = (profile.totalPoints || 0) - 3;
    await updateProfile(event.expertId, { totalPoints: newPoints, level: calculateLevel(newPoints) });
  } catch (err) {
    logger.error({ err, event }, 'Error handling offer.rated event');
  }
}
