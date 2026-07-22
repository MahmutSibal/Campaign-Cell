import { db } from "@workspace/db";
import {
  usersTable, subscribersTable, campaignsTable, optimizationCasesTable,
  caseNotesTable, gamificationProfilesTable, pointsTransactionsTable,
  badgesTable, userBadgesTable, experimentsTable, auditLogsTable,
  subscriberOffersTable, predictionsTable, refreshTokensTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

const SEGMENTS = ["YUKSEK_DEGER", "RISKLI_KAYIP", "YENI_ABONE", "PASIF", "BELIRSIZ"] as const;
const TARIFFS = ["Platinum 100GB", "Gold 50GB", "Silver 25GB", "Bronze 10GB", "Student 5GB", "Kurumsal 200GB", "Aile 150GB"] as const;
const REGIONS = ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Gaziantep"] as const;
const EXPERTISE = ["Retention", "Upsell", "Data Packages", "Device Offers", "SME", "Enterprise"] as const;
const CAMPAIGN_TYPES = ["EK_PAKET", "TARIFE_YUKSELTME", "CIHAZ_FIRSATI", "SADAKAT"] as const;
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const CASE_STATUSES = ["CREATED", "ASSIGNED", "OPTIMIZING", "AB_TESTING", "OPTIMIZED", "PUBLISHED"] as const;
const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "MANUAL_OPTIMIZATION_REQUIRED", "OPTIMIZING", "AB_TESTING", "OPTIMIZED", "PUBLISHED", "ARCHIVED"] as const;

const TURKISH_NAMES = ["Ahmet Yılmaz", "Ayşe Kaya", "Mehmet Demir", "Fatma Şahin", "Mustafa Çelik", "Zeynep Arslan",
  "Ali Öztürk", "Elif Koç", "Emre Aydın", "Selin Doğan", "Burak Polat", "Deniz Yıldız", "Hasan Güneş", "Merve Erdoğan",
  "Onur Tekin", "Gül Özer", "Sercan Kaplan", "Pınar Ata", "Kadir Çavuş", "Yasemin Bulut", "Furkan Işık", "Nesrin Kurt",
  "İbrahim Toprak", "Hatice Şimşek", "Osman Duman", "Leyla Korkmaz", "Baran Soylu", "Tuğba Karakaş", "Murat Özkan", "Nazan Güler",
  "Kerem Aslan", "Canan Yıldırım", "Serhat Ekinci", "Arzu Kılıç", "Taner Demirci", "Sibel Uçar", "Volkan Acar", "Reyhan Uysal",
  "Hüseyin Bozkurt", "Sevgi Albayrak", "Ömer Tunç", "Dilek Saraç", "Tolga Durmaz", "Esra Başar", "Alpay Gürel", "Oya Alkan",
  "Cengiz Bayram", "Şule Erdal", "Ufuk Kara", "Bengü Karadeniz", "Selim Yiğit", "Hülya Doğru", "Rıfat Süleymanoğlu", "Şükran Koçak",
  "Cem Uzun", "Sema Çakır", "Barış Ayvaz", "Nilgün Tatlı", "Yiğit Demirbaş", "Gözde Çetin", "Serdar Öktem", "Filiz Uğurlu",
  "Aykut Kılıçarslan", "Tuba Karabulut", "Çağdaş Baysal", "Sevil Atak", "Erhan Büyük", "Derya Öncü", "Okan Solak", "Leman Göktürk",
  "Samet Yazıcı", "Melek Timuçin", "Orhan Dere", "Birsen Yıldırımkaya", "Umut Baştuğ", "Alev Sönmez", "Ferhat Çalışkan", "Songül Çiçek",
  "Özlem Demirköy", "Sinan Akdoğan", "Havva Günay", "Hakkı Aydoğan", "Buse Karaca", "Özgür Okur", "İlknur Sezer", "Kıvanç Bal",
  "Duygu Öztürk", "Ragıp Erdem", "Soner Yılmaz", "Pembe Aksoy", "Fırat Yıldız", "Suzan Başaran", "Erol Özdemir", "Nursel Kaygısız",
  "Haluk Akman", "Belgin Türk", "Turgay Çakar", "Mahinur Karabük", "Zeki Pekdoğan", "Nuray Tezcan", "Coşkun Ergin", "Burcu Anıl"];

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return min + Math.random() * (max - min); }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }
function future(days: number): Date { return new Date(Date.now() + days * 86400 * 1000); }
function past(days: number): Date { return new Date(Date.now() - days * 86400 * 1000); }

async function main() {
  console.log("🌱 Seeding CampaignCell database...");

  // Clear existing data
  await db.execute(sql`TRUNCATE refresh_tokens, audit_logs, user_badges, points_transactions, gamification_profiles, subscriber_offers, predictions, case_notes, optimization_cases, experiments, campaigns, subscribers, users, badges CASCADE`);

  // ── BADGES ─────────────────────────────────────────────────────────────
  const badgeDefs = [
    { name: "İlk Adım", description: "İlk optimizasyon vakasını tamamladı", icon: "star", requirement: "Complete 1 case" },
    { name: "Hız Ustası", description: "SLA süresi dolmadan 5 vakayı tamamladı", icon: "zap", requirement: "Complete 5 cases before SLA" },
    { name: "Dönüşüm Şampiyonu", description: "+20% dönüşüm artışı sağlayan 3 kampanya optimize etti", icon: "trophy", requirement: "3 campaigns with 20%+ conversion lift" },
    { name: "AI Müttefiki", description: "AI önerisini 10 kez kabul etti", icon: "brain", requirement: "Accept 10 AI recommendations" },
    { name: "Süper Uzman", description: "50 vakayı başarıyla tamamladı", icon: "award", requirement: "Complete 50 cases" },
    { name: "Kritik Kurtarıcı", description: "10 kritik vakayı SLA içinde tamamladı", icon: "shield", requirement: "Complete 10 critical cases within SLA" },
    { name: "A/B Deha", description: "5 A/B testi başarıyla sonuçlandırdı", icon: "flask", requirement: "Conclude 5 A/B experiments" },
    { name: "Aylık Şampiyon", description: "Ayın en yüksek puanını alan uzman", icon: "crown", requirement: "Top monthly ranking" },
  ];
  const insertedBadges = await db.insert(badgesTable).values(badgeDefs).returning();
  console.log(`  ✓ ${insertedBadges.length} badges`);

  // ── USERS ───────────────────────────────────────────────────────────────
  const expertEmails = [
    "ahmet.expert@turkcell.com.tr", "ayse.expert@turkcell.com.tr", "mehmet.expert@turkcell.com.tr",
    "fatma.expert@turkcell.com.tr", "mustafa.expert@turkcell.com.tr", "zeynep.expert@turkcell.com.tr",
    "ali.expert@turkcell.com.tr", "elif.expert@turkcell.com.tr", "emre.expert@turkcell.com.tr", "selin.expert@turkcell.com.tr",
  ];
  const supervisorEmails = [
    "burak.supervisor@turkcell.com.tr", "deniz.supervisor@turkcell.com.tr", "hasan.supervisor@turkcell.com.tr",
  ];
  const adminEmails = ["admin@turkcell.com.tr"];

  const staffUsers: { name: string; email: string; role: string; gsmNumber: string; expertise?: string; region?: string }[] = [];
  expertEmails.forEach((email, i) => {
    staffUsers.push({ name: TURKISH_NAMES[i], email, role: "CAMPAIGN_EXPERT", gsmNumber: `5${30 + i}100000${String(i).padStart(2, "0")}`, expertise: pick(EXPERTISE), region: pick(REGIONS) });
  });
  supervisorEmails.forEach((email, i) => {
    staffUsers.push({ name: TURKISH_NAMES[10 + i], email, role: "SUPERVISOR", gsmNumber: `5${40 + i}200000${String(i).padStart(2, "0")}`, region: pick(REGIONS) });
  });
  adminEmails.forEach((email, i) => {
    staffUsers.push({ name: "Admin User", email, role: "ADMIN", gsmNumber: `5301234${String(i).padStart(4, "0")}` });
  });

  const insertedStaff = await db.insert(usersTable).values(staffUsers).returning();
  console.log(`  ✓ ${insertedStaff.length} staff users`);

  const experts = insertedStaff.filter(u => u.role === "CAMPAIGN_EXPERT");

  // ── SUBSCRIBERS ──────────────────────────────────────────────────────────
  const subscriberData = Array.from({ length: 120 }, (_, i) => {
    const seg = SEGMENTS[i % 5];
    const churnRisk = seg === "RISKLI_KAYIP" ? rand(0.55, 0.95) : seg === "PASIF" ? rand(0.35, 0.65) : rand(0.05, 0.40);
    const valueScore = seg === "YUKSEK_DEGER" ? rand(0.70, 0.99) : seg === "YENI_ABONE" ? rand(0.15, 0.40) : rand(0.30, 0.75);
    return {
      name: TURKISH_NAMES[i % TURKISH_NAMES.length],
      gsmNumber: `5${35 + (i % 5)}${String(i + 100000000).slice(1)}`,
      segment: seg,
      tariff: pick(TARIFFS),
      monthlySpend: String(rand(25, 450).toFixed(2)),
      dataUsageGb: String(rand(0.5, 80).toFixed(2)),
      voiceMinutes: randInt(0, 2000),
      churnRisk: String(churnRisk.toFixed(3)),
      valueScore: String(valueScore.toFixed(3)),
      acceptedCampaigns: randInt(0, 8),
      rejectedCampaigns: randInt(0, 4),
    };
  });
  const insertedSubs = await db.insert(subscribersTable).values(subscriberData).returning();
  console.log(`  ✓ ${insertedSubs.length} subscribers`);

  // Create subscriber users (for login)
  const subUserData = insertedSubs.slice(0, 20).map((s, i) => ({
    name: s.name,
    email: `${s.gsmNumber}@subscriber.campaigncell.local`,
    gsmNumber: s.gsmNumber,
    role: "SUBSCRIBER",
  }));
  const insertedSubUsers = await db.insert(usersTable).values(subUserData).returning();
  console.log(`  ✓ ${insertedSubUsers.length} subscriber user accounts`);

  // ── CAMPAIGNS ────────────────────────────────────────────────────────────
  const campaignDefs = [
    { name: "Platinum EK Paket 50GB Kampanyası", type: "EK_PAKET", segment: "YUKSEK_DEGER", priority: "HIGH", discount: "25", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.891", conversionProbability: "0.743", aiReasoning: "Yüksek değerli abonelerin ek veri ihtiyacı analizi doğrultusunda oluşturuldu." },
    { name: "Kayıp Risk Önleme - Sadakat Paketi", type: "SADAKAT", segment: "RISKLI_KAYIP", priority: "CRITICAL", discount: "40", status: "ACTIVE", isAiAnalyzed: true, recommendationScore: "0.954", conversionProbability: "0.812", aiReasoning: "Son 60 gün içinde churn riski %35 artan aboneler için kritik kampanya." },
    { name: "Yeni Abone Hoş Geldin - Cihaz Fırsatı", type: "CIHAZ_FIRSATI", segment: "YENI_ABONE", priority: "MEDIUM", discount: "15", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.723", conversionProbability: "0.612", aiReasoning: "Aktivasyon kanalından gelen yeni abonelere cihaz teklifi." },
    { name: "Tarife Yükseltme - Gold'dan Platinum'a", type: "TARIFE_YUKSELTME", segment: "YUKSEK_DEGER", priority: "HIGH", discount: "20", status: "OPTIMIZING", isAiAnalyzed: true, recommendationScore: "0.834", conversionProbability: "0.701", aiReasoning: "Gold tarife kullanıcılarının %68'i son aydaki veri limitini aştı." },
    { name: "Pasif Abone Aktivasyon Kampanyası", type: "EK_PAKET", segment: "PASIF", priority: "MEDIUM", discount: "35", status: "ACTIVE", isAiAnalyzed: true, recommendationScore: "0.645", conversionProbability: "0.523", aiReasoning: "3 aydan uzun süredir kampanyaya tepki vermeyen pasif segment." },
    { name: "Kurumsal 200GB Ek Paket", type: "EK_PAKET", segment: "YUKSEK_DEGER", priority: "HIGH", discount: "30", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.912", conversionProbability: "0.789", aiReasoning: "Kurumsal segment için yüksek kapasiteli ek paket fırsatı." },
    { name: "Student Paket Yaz Kampanyası", type: "TARIFE_YUKSELTME", segment: "YENI_ABONE", priority: "LOW", discount: "50", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.687", conversionProbability: "0.574", aiReasoning: "Öğrenci segmenti yaz dönemi yoğun veri kullanımı analizi." },
    { name: "Churn Önleme Acil Sadakat", type: "SADAKAT", segment: "RISKLI_KAYIP", priority: "CRITICAL", discount: "45", status: "AB_TESTING", isAiAnalyzed: true, recommendationScore: "0.971", conversionProbability: "0.843", aiReasoning: "Son 30 günde faturasını ödemeyen yüksek değerli abone grubu." },
    { name: "Aile Paketi Upgrade Teklifi", type: "TARIFE_YUKSELTME", segment: "YUKSEK_DEGER", priority: "MEDIUM", discount: "20", status: "ACTIVE", isAiAnalyzed: true, recommendationScore: "0.756", conversionProbability: "0.634", aiReasoning: "Aile paketi kullanan abonelere genişletilmiş paket önerisi." },
    { name: "Yeni Nesil Akıllı Telefon Fırsatı", type: "CIHAZ_FIRSATI", segment: "YUKSEK_DEGER", priority: "HIGH", discount: "10", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.823", conversionProbability: "0.692", aiReasoning: "Mevcut cihazı 2 yıldan eski olan premium müşterilere hedefli teklif." },
    { name: "Bronze'dan Silver'a Terfi Kampanyası", type: "TARIFE_YUKSELTME", segment: "PASIF", priority: "LOW", discount: "30", status: "DRAFT", isAiAnalyzed: false, recommendationScore: null, conversionProbability: null, aiReasoning: null },
    { name: "Veri Aşım Uyarı Paketi", type: "EK_PAKET", segment: "BELIRSIZ", priority: "MEDIUM", discount: "22", status: "MANUAL_OPTIMIZATION_REQUIRED", isAiAnalyzed: false, recommendationScore: null, conversionProbability: null, aiReasoning: null },
    { name: "Sınırsız Sosyal Medya Paketi", type: "EK_PAKET", segment: "YENI_ABONE", priority: "MEDIUM", discount: "18", status: "OPTIMIZED", isAiAnalyzed: true, recommendationScore: "0.714", conversionProbability: "0.591", aiReasoning: "18-30 yaş segmenti sosyal medya kullanım yoğunluğu analizi." },
    { name: "Kurumsal Sesli Arama Paketi", type: "EK_PAKET", segment: "YUKSEK_DEGER", priority: "HIGH", discount: "25", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.867", conversionProbability: "0.745", aiReasoning: "Kurumsal segment ses dakika tüketim analizi." },
    { name: "Yaz Tatil Roaming Paketi", type: "EK_PAKET", segment: "YUKSEK_DEGER", priority: "MEDIUM", discount: "15", status: "ACTIVE", isAiAnalyzed: true, recommendationScore: "0.743", conversionProbability: "0.612", aiReasoning: "Yaz tatilinde yurt dışı bağlantı ihtiyacı tahmin modeli." },
    { name: "Kritik Churn - Anında Müdahale", type: "SADAKAT", segment: "RISKLI_KAYIP", priority: "CRITICAL", discount: "60", status: "ACTIVE", isAiAnalyzed: true, recommendationScore: "0.988", conversionProbability: "0.876", aiReasoning: "Hat iptali başvurusu geri çekilen yüksek değerli abone grubu." },
    { name: "5G Deneyim Kampanyası", type: "TARIFE_YUKSELTME", segment: "YUKSEK_DEGER", priority: "HIGH", discount: "20", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.845", conversionProbability: "0.712", aiReasoning: "5G kapsama alanındaki mevcut 4G kullanıcıları." },
    { name: "Sadakat Puanı 2X Kampanyası", type: "SADAKAT", segment: "PASIF", priority: "LOW", discount: "0", status: "ARCHIVED", isAiAnalyzed: true, recommendationScore: "0.578", conversionProbability: "0.451", aiReasoning: "Pasif segment için sadakat programı aktivasyon denemesi." },
    { name: "Yeni Nesil Tablet Fırsatı", type: "CIHAZ_FIRSATI", segment: "YUKSEK_DEGER", priority: "MEDIUM", discount: "12", status: "DRAFT", isAiAnalyzed: false, recommendationScore: null, conversionProbability: null, aiReasoning: null },
    { name: "Ekonomik Aile Paketi", type: "TARIFE_YUKSELTME", segment: "PASIF", priority: "LOW", discount: "35", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.634", conversionProbability: "0.512", aiReasoning: "Düşük aylık harcama yapan çok hatlı aile aboneleri." },
    { name: "Gece Yarısı Data Fırsatı", type: "EK_PAKET", segment: "YENI_ABONE", priority: "LOW", discount: "28", status: "ACTIVE", isAiAnalyzed: true, recommendationScore: "0.698", conversionProbability: "0.567", aiReasoning: "Gece saatlerinde yoğun veri tüketen genç kullanıcı segmenti." },
    { name: "Uçuş Modu Premium Paketi", type: "EK_PAKET", segment: "YUKSEK_DEGER", priority: "HIGH", discount: "22", status: "OPTIMIZING", isAiAnalyzed: true, recommendationScore: "0.812", conversionProbability: "0.678", aiReasoning: "Sık seyahat eden premium abone profili analizi." },
    { name: "Erken Uyarı Churn Paketi Q3", type: "SADAKAT", segment: "RISKLI_KAYIP", priority: "HIGH", discount: "38", status: "ACTIVE", isAiAnalyzed: true, recommendationScore: "0.923", conversionProbability: "0.798", aiReasoning: "Q3 2026 churn prediksiyon modeli çıktıları." },
    { name: "Kampüs Öğrenci Fırsatı", type: "TARIFE_YUKSELTME", segment: "YENI_ABONE", priority: "LOW", discount: "45", status: "PUBLISHED", isAiAnalyzed: true, recommendationScore: "0.712", conversionProbability: "0.589", aiReasoning: "Üniversite lokasyonu ve öğrenci doğrulaması yapılmış kullanıcılar." },
    { name: "Black Friday Hazırlık Kampanyası", type: "CIHAZ_FIRSATI", segment: "BELIRSIZ", priority: "MEDIUM", discount: "20", status: "DRAFT", isAiAnalyzed: false, recommendationScore: null, conversionProbability: null, aiReasoning: null },
  ];

  const now = new Date();
  const insertedCampaigns = await db.insert(campaignsTable).values(campaignDefs.map((c, i) => ({
    ...c,
    discount: String(c.discount),
    startDate: past(30 - i).toISOString().slice(0, 10),
    endDate: future(60 + i * 2).toISOString().slice(0, 10),
    createdBy: experts[i % experts.length]?.id,
    conversionRate: c.isAiAnalyzed ? String(rand(0.08, 0.35).toFixed(4)) : null,
  }))).returning();
  console.log(`  ✓ ${insertedCampaigns.length} campaigns`);

  // ── OPTIMIZATION CASES ────────────────────────────────────────────────────
  const caseData = insertedCampaigns.slice(0, 22).map((campaign, i) => {
    const priority = PRIORITIES[i % 4];
    const status = CASE_STATUSES[i % CASE_STATUSES.length];
    const assignedExpert = i % 3 === 0 ? null : experts[i % experts.length];
    const slaHours = priority === "CRITICAL" ? 4 : priority === "HIGH" ? 8 : priority === "MEDIUM" ? 24 : 72;
    const slaDeadline = new Date(Date.now() + (i % 4 === 0 ? -2 : slaHours) * 3600 * 1000);
    return {
      caseCode: `CMP-2026-${String(i + 1).padStart(6, "0")}`,
      campaignId: campaign.id,
      status: status === "ASSIGNED" && !assignedExpert ? "CREATED" : status,
      priority,
      segment: campaign.segment,
      assignedExpertId: assignedExpert?.id ?? null,
      aiScore: String(rand(0.50, 0.99).toFixed(3)),
      conversionProbability: String(rand(0.40, 0.90).toFixed(3)),
      aiReasoning: campaign.aiReasoning ?? `${campaign.segment} segmenti için analiz tamamlandı.`,
      optimizationNote: ["OPTIMIZED", "PUBLISHED"].includes(status) ? `${campaign.name} için optimizasyon tamamlandı. Hedef kitleye özel indirim oranı ve zamanlama belirlendi.` : null,
      slaDeadline,
      slaBreached: slaDeadline < now,
    };
  });

  const insertedCases = await db.insert(optimizationCasesTable).values(caseData).returning();
  console.log(`  ✓ ${insertedCases.length} optimization cases`);

  // Case notes
  const noteTemplates = [
    "Müşteri segmenti analizi tamamlandı. AI önerilen indirim oranı %{n} olarak belirlendi.",
    "A/B test sonuçları incelendi. Variant B daha yüksek dönüşüm gösteriyor.",
    "SLA riski gözlemlendi. Acil öncelik verilmesi gerekiyor.",
    "Müşteri geçmişi incelendi, kampanya parametreleri güncellendi.",
    "Supervisor ile görüşüldü. Mevcut strateji devam edecek.",
    "Rakip analizi yapıldı. Pazar konumlandırması güncellendi.",
    "AI accuracy skoru %87 - tahmin güvenilir.",
    "Kampanya yayına hazır, son onay bekleniyor.",
  ];

  const caseNoteData: { caseId: string; authorId: string; authorName: string; content: string }[] = [];
  insertedCases.slice(0, 15).forEach((c, i) => {
    const expert = experts[i % experts.length];
    if (!expert) return;
    const noteCount = randInt(1, 3);
    for (let j = 0; j < noteCount; j++) {
      caseNoteData.push({
        caseId: c.id,
        authorId: expert.id,
        authorName: expert.name,
        content: noteTemplates[(i + j) % noteTemplates.length].replace("{n}", String(randInt(15, 45))),
      });
    }
  });
  if (caseNoteData.length) await db.insert(caseNotesTable).values(caseNoteData);
  console.log(`  ✓ ${caseNoteData.length} case notes`);

  // ── GAMIFICATION ────────────────────────────────────────────────────────
  const profileData = experts.map((e, i) => {
    const pts = randInt(20, 650);
    return {
      userId: e.id,
      totalPoints: pts,
      level: pts >= 500 ? "PLATINUM" : pts >= 200 ? "GOLD" : pts >= 75 ? "SILVER" : "BRONZE",
      completedCases: randInt(3, 45),
    };
  });
  await db.insert(gamificationProfilesTable).values(profileData);

  // Points transactions
  const txData: { userId: string; points: number; reason: string; caseId?: string }[] = [];
  experts.forEach((e, i) => {
    const txCount = randInt(5, 20);
    const reasons = ["Optimization Completed", "Fast Optimization (+5 bonus)", "A/B Test Concluded", "Critical Case Resolved", "Monthly Champion Bonus"];
    for (let j = 0; j < txCount; j++) {
      txData.push({ userId: e.id, points: randInt(5, 25), reason: pick(reasons) });
    }
  });
  if (txData.length) await db.insert(pointsTransactionsTable).values(txData);

  // Award badges
  const badgeAwardData: { userId: string; badgeId: string }[] = [];
  experts.forEach((e, i) => {
    const numBadges = randInt(1, Math.min(4, insertedBadges.length));
    insertedBadges.slice(0, numBadges).forEach(badge => {
      badgeAwardData.push({ userId: e.id, badgeId: badge.id });
    });
  });
  if (badgeAwardData.length) await db.insert(userBadgesTable).values(badgeAwardData);
  console.log(`  ✓ Gamification profiles, transactions & badges`);

  // ── SUBSCRIBER OFFERS ───────────────────────────────────────────────────
  const publishedCampaigns = insertedCampaigns.filter(c => c.status === "PUBLISHED");
  const offerData: {
    subscriberId: string; campaignId: string; status: string;
    recommendationScore: string; conversionProbability: string; aiReasoning: string;
  }[] = [];
  insertedSubs.slice(0, 60).forEach((sub, si) => {
    const numOffers = randInt(1, Math.min(5, publishedCampaigns.length));
    publishedCampaigns.slice(0, numOffers).forEach((camp, ci) => {
      const score = rand(0.40, 0.98);
      const statuses = ["PENDING", "PENDING", "ACCEPTED", "REJECTED", "RATED"];
      offerData.push({
        subscriberId: sub.id,
        campaignId: camp.id,
        status: pick(statuses),
        recommendationScore: String(score.toFixed(3)),
        conversionProbability: String((score * 0.85).toFixed(3)),
        aiReasoning: `${sub.segment} segmenti kullanım profili ile ${camp.type} kampanya uyumu analiz edildi. Uyumluluk skoru: ${(score * 100).toFixed(0)}%.`,
      });
    });
  });
  if (offerData.length) await db.insert(subscriberOffersTable).values(offerData);
  console.log(`  ✓ ${offerData.length} subscriber offers`);

  // ── PREDICTIONS ─────────────────────────────────────────────────────────
  const predData = insertedCampaigns.slice(0, 10).flatMap((camp, ci) =>
    insertedSubs.slice(0, 15).map((sub, si) => ({
      campaignId: camp.id,
      subscriberId: sub.id,
      recommendationScore: String(rand(0.35, 0.99).toFixed(3)),
      conversionProbability: String(rand(0.25, 0.95).toFixed(3)),
      segment: sub.segment,
      priority: pick(PRIORITIES),
      reasoning: `${sub.segment} segmenti analizi tamamlandı.`,
      isAiMisclassified: Math.random() < 0.13,
    }))
  );
  if (predData.length) await db.insert(predictionsTable).values(predData);
  console.log(`  ✓ ${predData.length} AI predictions`);

  // ── EXPERIMENTS ──────────────────────────────────────────────────────────
  const experimentData = [
    { campaign: insertedCampaigns[7], status: "RUNNING", variantADiscount: "35", variantBDiscount: "45", aImpr: 523, aConv: 87, bImpr: 541, bConv: 112 },
    { campaign: insertedCampaigns[1], status: "CONCLUDED", variantADiscount: "30", variantBDiscount: "40", aImpr: 890, aConv: 143, bImpr: 876, bConv: 198, winner: "B", conclusion: "Variant B %15 daha yüksek dönüşüm oranı gösterdi. %40 indirim stratejisi onaylandı." },
    { campaign: insertedCampaigns[0], status: "RUNNING", variantADiscount: "20", variantBDiscount: "25", aImpr: 312, aConv: 58, bImpr: 298, bConv: 61 },
    { campaign: insertedCampaigns[3], status: "CONCLUDED", variantADiscount: "15", variantBDiscount: "20", aImpr: 678, aConv: 98, bImpr: 654, bConv: 134, winner: "B", conclusion: "Tarife yükseltme A/B testi tamamlandı. %20 indirim eşiği daha etkili bulundu." },
    { campaign: insertedCampaigns[15], status: "RUNNING", variantADiscount: "50", variantBDiscount: "60", aImpr: 145, aConv: 67, bImpr: 138, bConv: 78 },
  ];

  const expInserts = experimentData.map(e => ({
    campaignId: e.campaign.id,
    name: `${e.campaign.name} - A/B Test`,
    description: `${e.campaign.segment} segmenti için indirim oranı optimizasyonu`,
    status: e.status,
    variantADiscount: e.variantADiscount,
    variantBDiscount: e.variantBDiscount,
    variantAImpressions: e.aImpr,
    variantAConversions: e.aConv,
    variantBImpressions: e.bImpr,
    variantBConversions: e.bConv,
    winner: (e as { winner?: string }).winner ?? null,
    conclusion: (e as { conclusion?: string }).conclusion ?? null,
    concludedAt: (e as { winner?: string }).winner ? past(7) : null,
  }));
  await db.insert(experimentsTable).values(expInserts);
  console.log(`  ✓ ${expInserts.length} A/B experiments`);

  // ── AUDIT LOGS ───────────────────────────────────────────────────────────
  const allStaff = insertedStaff;
  const actions = ["CAMPAIGN_CREATE", "CAMPAIGN_PUBLISH", "CASE_ASSIGN", "CASE_COMPLETE", "USER_LOGIN", "USER_LOCK", "CAMPAIGN_ANALYZE", "EXPERIMENT_CONCLUDE"];
  const resources = ["campaigns", "cases", "users", "experiments", "ai"];
  const auditData = Array.from({ length: 80 }, (_, i) => {
    const user = allStaff[i % allStaff.length];
    return {
      userId: user.id,
      userName: user.name,
      action: pick(actions),
      resource: pick(resources),
      result: Math.random() > 0.05 ? "SUCCESS" : "FAILURE",
      ipAddress: `10.0.${randInt(0, 255)}.${randInt(1, 254)}`,
      details: `Demo audit entry #${i + 1}`,
    };
  });
  await db.insert(auditLogsTable).values(auditData);
  console.log(`  ✓ ${auditData.length} audit logs`);

  console.log("\n✅ Seed complete! CampaignCell database ready.");
  console.log("\nDemo login credentials:");
  console.log("  Expert:     ahmet.expert@turkcell.com.tr  (role: CAMPAIGN_EXPERT)");
  console.log("  Supervisor: burak.supervisor@turkcell.com.tr  (role: SUPERVISOR)");
  console.log("  Admin:      admin@turkcell.com.tr  (role: ADMIN)");
  console.log("  Subscriber: any GSM from subscriber list, OTP: 1234");
  process.exit(0);
}

main().catch(e => { console.error("Seed failed:", e); process.exit(1); });
