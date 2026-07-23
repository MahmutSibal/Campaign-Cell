import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Campaign Service seed.
 *
 * NOT: Sahte/örnek kampanya ve optimizasyon vakaları KALDIRILDI. Sistem gerçek veriyle sunulur —
 * kampanyalar ve vakalar demoda uzman tarafından canlı olarak oluşturulur (AI skorlama gerçek üretilir).
 * Bu seed bilinçli olarak boştur; entrypoint'in `prisma db seed` adımının başarılı çalışması için durur.
 */
async function main() {
  console.log('Campaign Service seed: örnek veri yok (gerçek veriyle çalışılır).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
