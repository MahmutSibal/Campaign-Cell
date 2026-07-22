import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db/schema';
import { initDb } from './db/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const SEGMENTS = ['YUKSEK_DEGER', 'RISKLI_KAYIP', 'YENI_ABONE', 'PASIF', 'BELIRSIZ'];
const TARIFFS = ['Akıllı 5GB', 'Akıllı 10GB', 'Süper 15GB', 'Süper 20GB', 'Süper 30GB', 'Gold 25GB', 'Platin Sınırsız', 'Baz 3GB', 'Orta 15GB', 'Başlangıç 2GB'];
const NAMES = ['Mehmet Demir', 'Fatma Şahin', 'Ahmet Yılmaz', 'Zeynep Kaya', 'Ali Çelik', 'Hatice Arslan', 'Mustafa Doğan', 'Emine Yıldız', 'Hüseyin Öztürk', 'Ayşe Şimşek', 'İbrahim Aydın', 'Meryem Polat', 'Hasan Demir', 'Fatma Koç', 'Osman Kurtoğlu', 'Hacer Güneş', 'Recep Özdemir', 'Zeliha Bozkurt', 'Mehmet Erdoğan', 'Selma Akın', 'Kadir Yıldırım', 'Havva Çetin', 'Yusuf Güzel', 'Rabia Doğru', 'Serkan Atak', 'Derya Kılıç', 'Tolga Özcan', 'Merve Kara', 'Burak Sarı', 'Canan Tunç', 'Erkan Deniz', 'Seda Yılmaz', 'Furkan Aksoy', 'Neslihan Bulut', 'Onur Güler', 'Pınar Işık', 'Baran Acar', 'Şeyma Uzun', 'Uğur Çoban', 'Tuğba Öz'];

function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[rndInt(0, arr.length - 1)]; }

async function seed() {
  await initDb();

  // 120 Subscribers
  const subs: any[] = [];
  for (let i = 0; i < 120; i++) {
    const segment = pick(SEGMENTS);
    const churnRisk = segment === 'RISKLI_KAYIP' ? rnd(0.55, 0.95) : segment === 'PASIF' ? rnd(0.3, 0.6) : rnd(0.05, 0.35);
    const valueScore = segment === 'YUKSEK_DEGER' ? rnd(0.7, 0.99) : segment === 'PASIF' ? rnd(0.1, 0.4) : rnd(0.3, 0.75);
    const monthlySpend = segment === 'YUKSEK_DEGER' ? rnd(250, 600) : segment === 'PASIF' ? rnd(20, 80) : rnd(60, 300);
    const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '');
    subs.push({
      name,
      gsmNumber: `0535${String(i).padStart(7, '0')}`,
      segment,
      tariff: pick(TARIFFS),
      monthlySpend: monthlySpend.toFixed(2),
      dataUsageGb: rnd(1, 90).toFixed(2),
      voiceMinutes: rndInt(0, 2000),
      churnRisk: churnRisk.toFixed(4),
      valueScore: valueScore.toFixed(4),
      acceptedCampaigns: rndInt(0, 8),
      rejectedCampaigns: rndInt(0, 6),
    });
  }
  const insertedSubs = await db.insert(schema.subscribersTable).values(subs).onConflictDoNothing().returning();

  // 25 Campaigns
  const TYPES = ['EK_PAKET', 'TARIFE_YUKSELTME', 'CIHAZ_FIRSATI', 'SADAKAT'];
  const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  const campaigns: any[] = [];
  for (let i = 0; i < 25; i++) {
    const segment = pick(SEGMENTS);
    campaigns.push({
      name: `Kampanya ${i + 1} - ${segment}`,
      description: `${segment} segmenti için özel kampanya`,
      type: pick(TYPES),
      status: pick(STATUSES),
      segment,
      priority: pick(['DUSUK', 'ORTA', 'YUKSEK', 'KRITIK']),
      discount: rndInt(10, 50),
      campaignCode: `CMP-2026-${String(i + 1).padStart(6, '0')}`,
      isAiAnalyzed: Math.random() > 0.3,
      recommendationScore: rnd(0.4, 0.95).toFixed(4),
      conversionProbability: rnd(0.3, 0.75).toFixed(4),
      aiReasoning: `AI analizi: ${segment} segmentine uygun kampanya`,
      createdBy: 'ahmet-expert',
      startDate: new Date(Date.now() - rnd(0, 30) * 86400000),
      endDate: new Date(Date.now() + rnd(7, 90) * 86400000),
    });
  }
  const insertedCampaigns = await db.insert(schema.campaignsTable).values(campaigns).onConflictDoNothing().returning();

  // 22 Optimization Cases
  const CASE_STATUSES = ['YENI', 'ATANDI', 'OPTIMIZE_EDILIYOR', 'TEST_EDILIYOR', 'TAMAMLANDI', 'YAYINDA'];
  const EXPERT_NAMES = [{ id: 'ahmet-expert', name: 'Ahmet Expert' }, { id: 'mehmet-expert', name: 'Mehmet Expert' }, { id: 'zeynep-expert', name: 'Zeynep Expert' }];
  const cases: any[] = [];
  for (let i = 0; i < 22; i++) {
    const status = pick(CASE_STATUSES);
    const priority = pick(['ORTA', 'YUKSEK', 'KRITIK', 'DUSUK']);
    const expert = pick(EXPERT_NAMES);
    const campaign = insertedCampaigns[i % insertedCampaigns.length];
    const slaHours = { KRITIK: 2, YUKSEK: 8, ORTA: 24, DUSUK: 72 }[priority as string] || 24;
    cases.push({
      caseCode: `CASE-2026-${String(i + 1).padStart(5, '0')}`,
      campaignId: campaign?.id,
      status,
      priority,
      segment: pick(SEGMENTS),
      assignedExpertId: status !== 'YENI' ? expert.id : null,
      assignedExpertName: status !== 'YENI' ? expert.name : null,
      aiScore: rnd(0.4, 0.9).toFixed(4),
      conversionProbability: rnd(0.3, 0.7).toFixed(4),
      aiReasoning: 'AI segment analizi tamamlandı',
      optimizationNote: status === 'TAMAMLANDI' ? `Segment optimizasyonu tamamlandı. Dönüşüm oranı %${rndInt(12, 28)} artış gösterdi.` : null,
      slaDeadline: new Date(Date.now() + rnd(-slaHours, slaHours * 2) * 3600000),
      slaBreached: Math.random() < 0.15,
    });
  }
  await db.insert(schema.optimizationCasesTable).values(cases).onConflictDoNothing();

  // 60 Subscriber Offers
  const OFFER_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'RATED'];
  const offers: any[] = [];
  for (let i = 0; i < 60 && i < insertedSubs.length && insertedCampaigns.length > 0; i++) {
    const sub = insertedSubs[i % insertedSubs.length];
    const camp = insertedCampaigns[i % insertedCampaigns.length];
    const status = pick(OFFER_STATUSES);
    offers.push({
      subscriberId: sub.id,
      campaignId: camp.id,
      status,
      recommendationScore: rnd(0.60, 0.95).toFixed(4),
      conversionProbability: rnd(0.40, 0.80).toFixed(4),
      aiReasoning: 'Segment uyumu ve kullanım profili değerlendirmesi.',
      rating: status === 'RATED' ? rndInt(1, 5) : null,
      rejectionReason: status === 'REJECTED' ? pick(['İlgilenmiyorum', 'Fiyat yüksek', 'Zaten abonum', 'Uygun değil']) : null,
    });
  }
  if (offers.length > 0) await db.insert(schema.subscriberOffersTable).values(offers).onConflictDoNothing();

  // 5 A/B Experiments
  const exps: any[] = [];
  for (let i = 0; i < 5 && i < insertedCampaigns.length; i++) {
    const camp = insertedCampaigns[i];
    exps.push({
      campaignId: camp.id,
      name: `A/B Test ${i + 1}: İndirim Oranı`,
      description: 'Farklı indirim oranlarının dönüşüm üzerindeki etkisi',
      status: i < 2 ? 'CONCLUDED' : 'RUNNING',
      variantADiscount: rndInt(10, 20),
      variantBDiscount: rndInt(21, 40),
      variantAImpressions: rndInt(100, 500),
      variantAConversions: rndInt(10, 80),
      variantBImpressions: rndInt(100, 500),
      variantBConversions: rndInt(15, 100),
      winner: i < 2 ? pick(['A', 'B']) : null,
      conclusion: i < 2 ? 'Yüksek indirim oranı daha iyi dönüşüm sağladı' : null,
      concludedAt: i < 2 ? new Date(Date.now() - rndInt(1, 10) * 86400000) : null,
    });
  }
  if (exps.length > 0) await db.insert(schema.experimentsTable).values(exps).onConflictDoNothing();

  console.log(`✅ Campaign service seeded: 120 subs, 25 campaigns, 22 cases, ${offers.length} offers, ${exps.length} experiments`);
  await pool.end();
}

seed().catch(console.error);
