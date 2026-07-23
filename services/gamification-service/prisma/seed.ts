import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Gamification Service Database...');

  // Badges (Case §6.2 — kazanılma koşulları)
  const badges = [
    { code: 'ILK_KAMPANYA', name: 'İlk Kampanya', description: 'İlk optimizasyonu tamamlama.' },
    { code: 'HIZ_USTASI', name: 'Hız Ustası', description: '2 saatin altında 10 optimizasyon tamamlama.' },
    { code: 'DONUSUM_KRALI', name: 'Dönüşüm Kralı', description: '10 kampanyada dönüşüm hedefini aşma.' },
    { code: 'MARATONCU', name: 'Maratoncu', description: 'Bir günde 20 optimizasyon tamamlama.' },
    { code: 'CHURN_AVCISI', name: 'Churn Avcısı', description: '10 RISKLI_KAYIP vakayı kurtarma.' },
    { code: 'UZMAN', name: 'Uzman', description: 'Tek segmentte 50 optimizasyon tamamlama.' },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: { name: badge.name, description: badge.description },
      create: badge,
    });
  }

  // Levels (Case §6.3 — Platin 3.000+ üst sınırsız)
  const levels = [
    { name: 'Bronz', minPoints: 0, maxPoints: 499 },
    { name: 'Gümüş', minPoints: 500, maxPoints: 1499 },
    { name: 'Altın', minPoints: 1500, maxPoints: 2999 },
    { name: 'Platin', minPoints: 3000, maxPoints: null as number | null },
  ];

  for (const level of levels) {
    await prisma.level.upsert({
      where: { name: level.name },
      update: { minPoints: level.minPoints, maxPoints: level.maxPoints },
      create: level,
    });
  }

  // NOT: Sahte puan/leaderboard verisi KALDIRILDI. Puanlar yalnızca gerçek 'campaign.optimized'
  // event'leriyle (uzman optimizasyonu tamamladığında) oluşur. Liderlik tablosu canlı veriyle dolar.
  // Yalnızca rozet ve seviye TANIMLARI (case §6.2/§6.3 master config) seed edilir.

  console.log('Gamification Service Seeding Completed (badges + levels only, no fake points).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
