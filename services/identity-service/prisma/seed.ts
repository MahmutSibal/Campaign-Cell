import { PrismaClient, RoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Identity Service Database...');

  const passwordHash = await bcrypt.hash('Turkcell2026!', 10);

  // 1. Subscriber User
  await prisma.user.upsert({
    where: { gsmNumber: '05551112233' },
    update: {},
    create: {
      role: RoleEnum.SUBSCRIBER,
      gsmNumber: '05551112233',
      email: 'ahmet.yilmaz@gmail.com',
      passwordHash,
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      region: 'İstanbul - Kadıköy',
      expertiseTags: [],
    },
  });

  // 2. Campaign Expert Users — sabit UUID'ler Gamification seed'iyle HİZALIDIR
  // (liderlik tablosunda isim çözümlenir + AI akıllı ataması gerçek segment-uzman verisiyle çalışır).
  const experts = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      email: 'uzman@turkcell.com.tr',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      region: 'İstanbul',
      // RISKLI_KAYIP / churn uzmanı (leaderboard #1)
      expertiseTags: ['Churn Önleme', 'RISKLI_KAYIP', 'Sadakat'],
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      email: 'uzman2@turkcell.com.tr',
      firstName: 'Zeynep',
      lastName: 'Kaya',
      region: 'Ankara',
      // YUKSEK_DEGER / tarife uzmanı (leaderboard #2)
      expertiseTags: ['YUKSEK_DEGER', 'Tarife Yükseltme', 'Sadakat'],
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      email: 'uzman3@turkcell.com.tr',
      firstName: 'Mehmet',
      lastName: 'Demir',
      region: 'İzmir',
      // YENI_ABONE / ek paket uzmanı (leaderboard #3)
      expertiseTags: ['YENI_ABONE', 'Ek Paket', 'PASIF'],
    },
  ];

  for (const e of experts) {
    await prisma.user.upsert({
      where: { email: e.email },
      update: { expertiseTags: e.expertiseTags, region: e.region },
      create: {
        id: e.id,
        role: RoleEnum.CAMPAIGN_EXPERT,
        email: e.email,
        passwordHash,
        firstName: e.firstName,
        lastName: e.lastName,
        region: e.region,
        expertiseTags: e.expertiseTags,
      },
    });
  }

  // 3. Supervisor User
  await prisma.user.upsert({
    where: { email: 'supervisor@turkcell.com.tr' },
    update: {},
    create: {
      role: RoleEnum.SUPERVISOR,
      email: 'supervisor@turkcell.com.tr',
      passwordHash,
      firstName: 'Süpervizör',
      lastName: 'Yönetici',
      region: 'Genel Merkez',
      expertiseTags: ['Analitik', 'SLA', 'Liderlik'],
    },
  });

  // 4. Admin User
  await prisma.user.upsert({
    where: { email: 'admin@turkcell.com.tr' },
    update: {},
    create: {
      role: RoleEnum.ADMIN,
      email: 'admin@turkcell.com.tr',
      passwordHash,
      firstName: 'Sistem',
      lastName: 'Yöneticisi (Admin)',
      region: 'Genel Merkez',
      expertiseTags: ['Sistem', 'Güvenlik', 'Yönetim'],
    },
  });

  console.log('Identity Service Seeding Completed Successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
