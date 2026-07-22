import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { gamificationProfilesTable, pointsTransactionsTable, badgesTable, userBadgesTable } from './db/schema';
import { initDb } from './db/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { gamificationProfilesTable, pointsTransactionsTable, badgesTable, userBadgesTable } });

async function seed() {
  await initDb();

  // Badges
  const badges = [
    { id: 'ilk-kampanya', name: 'İlk Kampanya', description: 'İlk optimizasyonu tamamla', icon: '🏆', requirement: 'completedCases >= 1' },
    { id: 'hiz-ustasi', name: 'Hız Ustası', description: '2 saatin altında 10 optimizasyon', icon: '⚡', requirement: 'fastCompletions >= 10' },
    { id: 'donusum-krali', name: 'Dönüşüm Kralı', description: '10 kampanyada hedef aşımı', icon: '👑', requirement: 'conversionTargetHits >= 10' },
    { id: 'maratoncu', name: 'Maratoncu', description: 'Bir günde 20 optimizasyon', icon: '🏃', requirement: 'dailyCompletions >= 20' },
    { id: 'churn-avcisi', name: 'Churn Avcısı', description: '10 RISKLI_KAYIP vakayı kurtarma', icon: '🎯', requirement: 'churnCasesResolved >= 10' },
    { id: 'uzman', name: 'Uzman', description: 'Tek segmentte 50 optimizasyon', icon: '🌟', requirement: 'completedCases >= 50' },
    { id: 'guvenilir', name: 'Güvenilir', description: '100 vaka tamamla', icon: '🛡️', requirement: 'completedCases >= 100' },
    { id: 'efsane', name: 'Efsane', description: '3000 puana ulaş', icon: '⭐', requirement: 'totalPoints >= 3000' },
  ];

  for (const b of badges) {
    await db.insert(badgesTable).values(b).onConflictDoNothing();
  }

  // Expert profiles with varied points
  const profiles = [
    { userId: 'ahmet-expert', userName: 'Ahmet Expert', totalPoints: 1850, level: 'ALTIN', completedCases: 45, fastCompletions: 12, conversionTargetHits: 11, churnCasesResolved: 8 },
    { userId: 'mehmet-expert', userName: 'Mehmet Expert', totalPoints: 780, level: 'GÜMÜŞ', completedCases: 32, fastCompletions: 5, conversionTargetHits: 4, churnCasesResolved: 3 },
    { userId: 'zeynep-expert', userName: 'Zeynep Expert', totalPoints: 620, level: 'GÜMÜŞ', completedCases: 28, fastCompletions: 3, conversionTargetHits: 2, churnCasesResolved: 0 },
    { userId: 'ayse-expert', userName: 'Ayşe Expert', totalPoints: 3150, level: 'PLATIN', completedCases: 51, fastCompletions: 15, conversionTargetHits: 14, churnCasesResolved: 12 },
    { userId: 'fatih-expert', userName: 'Fatih Expert', totalPoints: 1200, level: 'GÜMÜŞ', completedCases: 38, fastCompletions: 8, conversionTargetHits: 9, churnCasesResolved: 2 },
    { userId: 'selin-expert', userName: 'Selin Expert', totalPoints: 320, level: 'BRONZ', completedCases: 22, fastCompletions: 4, conversionTargetHits: 3, churnCasesResolved: 0 },
    { userId: 'emre-expert', userName: 'Emre Expert', totalPoints: 950, level: 'GÜMÜŞ', completedCases: 29, fastCompletions: 6, conversionTargetHits: 5, churnCasesResolved: 5 },
    { userId: 'burak-supervisor', userName: 'Burak Supervisor', totalPoints: 250, level: 'BRONZ', completedCases: 5, fastCompletions: 0, conversionTargetHits: 0, churnCasesResolved: 0 },
    { userId: 'can-supervisor', userName: 'Can Supervisor', totalPoints: 180, level: 'BRONZ', completedCases: 3, fastCompletions: 0, conversionTargetHits: 0, churnCasesResolved: 0 },
  ];

  for (const p of profiles) {
    await db.insert(gamificationProfilesTable).values(p).onConflictDoNothing();
  }

  // Point transactions for variety
  const now = Date.now();
  const txs = [
    { userId: 'ahmet-expert', points: 10, reason: 'Vaka tamamlandı: CMP-2026-000001', createdAt: new Date(now - 6 * 3600000) },
    { userId: 'ahmet-expert', points: 15, reason: 'Dönüşüm hedefi aşıldı', createdAt: new Date(now - 5 * 3600000) },
    { userId: 'ahmet-expert', points: 5, reason: 'Hızlı tamamlama bonusu', createdAt: new Date(now - 4 * 3600000) },
    { userId: 'ayse-expert', points: 15, reason: 'Kritik vaka SLA içinde tamamlandı', createdAt: new Date(now - 3 * 3600000) },
    { userId: 'mehmet-expert', points: 10, reason: 'Vaka tamamlandı: CMP-2026-000003', createdAt: new Date(now - 2 * 3600000) },
    { userId: 'selin-expert', points: -5, reason: 'SLA aşımı', createdAt: new Date(now - 1 * 3600000) },
    { userId: 'fatih-expert', points: 10, reason: 'Vaka tamamlandı: CMP-2026-000005', createdAt: new Date(now - 30 * 60000) },
    { userId: 'emre-expert', points: 10, reason: 'Vaka tamamlandı: CMP-2026-000007', createdAt: new Date(now - 15 * 60000) },
  ];

  for (const tx of txs) {
    await db.insert(pointsTransactionsTable).values(tx).onConflictDoNothing();
  }

  // Award earned badges
  const earnedBadges = [
    { userId: 'ahmet-expert', badgeId: 'ilk-kampanya' },
    { userId: 'ahmet-expert', badgeId: 'hiz-ustasi' },
    { userId: 'ahmet-expert', badgeId: 'donusum-krali' },
    { userId: 'ayse-expert', badgeId: 'ilk-kampanya' },
    { userId: 'ayse-expert', badgeId: 'hiz-ustasi' },
    { userId: 'ayse-expert', badgeId: 'donusum-krali' },
    { userId: 'ayse-expert', badgeId: 'churn-avcisi' },
    { userId: 'ayse-expert', badgeId: 'uzman' },
    { userId: 'ayse-expert', badgeId: 'efsane' },
    { userId: 'mehmet-expert', badgeId: 'ilk-kampanya' },
    { userId: 'fatih-expert', badgeId: 'ilk-kampanya' },
    { userId: 'emre-expert', badgeId: 'ilk-kampanya' },
    { userId: 'zeynep-expert', badgeId: 'ilk-kampanya' },
    { userId: 'selin-expert', badgeId: 'ilk-kampanya' },
  ];

  for (const b of earnedBadges) {
    await db.insert(userBadgesTable).values(b).onConflictDoNothing();
  }

  console.log('✅ Gamification service seeded successfully');
  await pool.end();
}

seed().catch(console.error);
