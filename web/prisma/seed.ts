import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const DATA_DIR = path.resolve(__dirname, '../../bot/data');

async function main() {
  console.log('Seeding database...');

  await prisma.botSetting.upsert({
    where: { key: 'responseDelay' },
    update: {},
    create: { key: 'responseDelay', value: '0' },
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
