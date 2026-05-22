import 'dotenv/config';
import { prisma } from '../db/client';
import { computeHash } from '../lib/hasher';

async function main() {
  console.log('Seeding sample log entries...');
  await prisma.logEntry.deleteMany();

  const e1 = await prisma.logEntry.create({
    data: {
      actor: 'alice',
      action: 'signup',
      payload: { plan: 'free' },
      eventTime: new Date().toISOString(),
      previousHash: '0',
      currentHash: '',
    },
  });

  const h1 = computeHash('0', e1.actor, e1.action, e1.payload, e1.eventTime);
  await prisma.logEntry.update({ where: { id: e1.id }, data: { currentHash: h1 } });

  const e2 = await prisma.logEntry.create({
    data: {
      actor: 'bob',
      action: 'purchase',
      payload: { item: 'pen', qty: 2 },
      eventTime: new Date().toISOString(),
      previousHash: h1,
      currentHash: '',
    },
  });

  const h2 = computeHash(h1, e2.actor, e2.action, e2.payload, e2.eventTime);
  await prisma.logEntry.update({ where: { id: e2.id }, data: { currentHash: h2 } });

  console.log('Seed complete:', { firstId: e1.id, secondId: e2.id });
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});