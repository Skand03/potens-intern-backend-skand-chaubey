import 'dotenv/config';
import { verifyChain } from '../lib/verifier';
import { prisma } from '../db/client';

async function main() {
  console.log('Verifying chain integrity...\n');

  const result = await verifyChain();
  console.log(JSON.stringify(result, null, 2));

  if (result.status === 'fail') {
    console.error(`\n✗ Chain BROKEN at entry ${result.broken_id}: ${result.reason}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`\n✓ Chain intact. ${result.checked} entries verified.`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});