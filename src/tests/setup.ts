import { prisma } from '../db/client';

beforeAll(async () => {
  await prisma.logEntry.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});