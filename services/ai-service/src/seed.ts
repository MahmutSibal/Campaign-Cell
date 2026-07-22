import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { predictionsTable, expertProfilesTable } from './db/schema';
import { initDb } from './db/client';
import { scoreSubscriberForCampaign, classifySegment } from './lib/scorer';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { predictionsTable, expertProfilesTable } });

async function seed() {
  await initDb();

  // Expert profiles
  const experts = [
    { expertId: 'ahmet-expert', expertName: 'Ahmet Expert', specializations: '["RISKLI_KAYIP","YUKSEK_DEGER"]', activeCases: 3, avgConversionLift: '0.182', completedCases: 45 },
    { expertId: 'mehmet-expert', expertName: 'Mehmet Expert', specializations: '["YENI_ABONE"]', activeCases: 2, avgConversionLift: '0.145', completedCases: 32 },
    { expertId: 'zeynep-expert', expertName: 'Zeynep Expert', specializations: '["PASIF"]', activeCases: 5, avgConversionLift: '0.165', completedCases: 28 },
    { expertId: 'ayse-expert', expertName: 'Ayşe Expert', specializations: '["RISKLI_KAYIP"]', activeCases: 1, avgConversionLift: '0.198', completedCases: 51 },
    { expertId: 'fatih-expert', expertName: 'Fatih Expert', specializations: '["YUKSEK_DEGER","SADAKAT"]', activeCases: 4, avgConversionLift: '0.155', completedCases: 38 },
    { expertId: 'selin-expert', expertName: 'Selin Expert', specializations: '["YENI_ABONE","PASIF"]', activeCases: 0, avgConversionLift: '0.132', completedCases: 22 },
    { expertId: 'emre-expert', expertName: 'Emre Expert', specializations: '["RISKLI_KAYIP","YENI_ABONE"]', activeCases: 2, avgConversionLift: '0.171', completedCases: 29 },
  ];

  for (const e of experts) {
    await db.insert(expertProfilesTable).values(e).onConflictDoNothing();
  }

  // Realistic predictions using actual scorer
  const testSubscribers = [
    { monthlySpend: 350, dataUsageGb: 65, voiceMinutes: 1200, churnRisk: 0.72, valueScore: 0.85, acceptedCampaigns: 3, rejectedCampaigns: 1, segment: 'RISKLI_KAYIP', tariff: 'Süper 30GB' },
    { monthlySpend: 85, dataUsageGb: 8, voiceMinutes: 200, churnRisk: 0.15, valueScore: 0.35, acceptedCampaigns: 0, rejectedCampaigns: 0, segment: 'YENI_ABONE', tariff: 'Akıllı 5GB' },
    { monthlySpend: 450, dataUsageGb: 90, voiceMinutes: 800, churnRisk: 0.08, valueScore: 0.95, acceptedCampaigns: 8, rejectedCampaigns: 0, segment: 'YUKSEK_DEGER', tariff: 'Platin Sınırsız' },
    { monthlySpend: 30, dataUsageGb: 2, voiceMinutes: 50, churnRisk: 0.45, valueScore: 0.20, acceptedCampaigns: 0, rejectedCampaigns: 6, segment: 'PASIF', tariff: 'Başlangıç 2GB' },
    { monthlySpend: 180, dataUsageGb: 35, voiceMinutes: 600, churnRisk: 0.55, valueScore: 0.60, acceptedCampaigns: 2, rejectedCampaigns: 2, segment: 'RISKLI_KAYIP', tariff: 'Orta 15GB' },
    { monthlySpend: 280, dataUsageGb: 50, voiceMinutes: 950, churnRisk: 0.25, valueScore: 0.75, acceptedCampaigns: 5, rejectedCampaigns: 1, segment: 'YUKSEK_DEGER', tariff: 'Gold 25GB' },
    { monthlySpend: 60, dataUsageGb: 5, voiceMinutes: 150, churnRisk: 0.88, valueScore: 0.25, acceptedCampaigns: 1, rejectedCampaigns: 4, segment: 'RISKLI_KAYIP', tariff: 'Baz 3GB' },
    { monthlySpend: 200, dataUsageGb: 42, voiceMinutes: 700, churnRisk: 0.30, valueScore: 0.68, acceptedCampaigns: 4, rejectedCampaigns: 0, segment: 'YUKSEK_DEGER', tariff: 'Süper 20GB' },
  ];

  const campaigns = [
    { type: 'EK_PAKET', discount: 30, segment: 'YUKSEK_DEGER' },
    { type: 'SADAKAT', discount: 25, segment: 'RISKLI_KAYIP' },
    { type: 'TARIFE_YUKSELTME', discount: 20, segment: 'PASIF' },
    { type: 'EK_PAKET', discount: 40, segment: 'YENI_ABONE' },
    { type: 'CIHAZ_FIRSATI', discount: 35, segment: 'YUKSEK_DEGER' },
  ];

  let count = 0;
  for (const sub of testSubscribers) {
    for (const camp of campaigns) {
      if (count >= 150) break;
      const score = scoreSubscriberForCampaign(sub, camp);
      const cls = classifySegment(sub);
      const misclassified = Math.random() < 0.12; // ~12% misclassification rate = ~88% accuracy
      await db.insert(predictionsTable).values({
        campaignId: `camp-seed-${count % 5 + 1}`,
        subscriberId: `sub-seed-${count % 8 + 1}`,
        recommendationScore: String(score.recommendationScore),
        conversionProbability: String(score.conversionProbability),
        segment: cls.segment,
        priority: cls.priority,
        reasoning: score.reasoning,
        isAiMisclassified: misclassified,
        correctedSegment: misclassified ? 'RISKLI_KAYIP' : null,
      });
      count++;
    }
  }

  console.log(`✅ AI service seeded: ${experts.length} expert profiles, ${count} predictions`);
  await pool.end();
}

seed().catch(console.error);
