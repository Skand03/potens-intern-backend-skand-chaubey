import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type LogEntryRecord = {
  id: number;
  actor: string;
  action: string;
  payload: unknown;
  eventTime: string;
  previousHash: string;
  currentHash: string;
  createdAt: Date;
};

type PrismaLike = {
  logEntry: {
    deleteMany: () => Promise<{ count: number }>;
    findFirst: (args?: { orderBy?: { id?: 'asc' | 'desc' } }) => Promise<LogEntryRecord | null>;
    findMany: (args?: {
      where?: {
        actor?: string;
        eventTime?: { gte?: string; lte?: string };
      };
      orderBy?: { id?: 'asc' | 'desc' };
    }) => Promise<LogEntryRecord[]>;
    findUnique: (args: { where: { id: number } }) => Promise<LogEntryRecord | null>;
    create: (args: { data: Omit<LogEntryRecord, 'id' | 'createdAt'> }) => Promise<LogEntryRecord>;
    update: (args: { where: { id: number }; data: Partial<Omit<LogEntryRecord, 'id'>> }) => Promise<LogEntryRecord>;
  };
  $transaction: <T>(fn: (tx: PrismaLike) => Promise<T>) => Promise<T>;
  $disconnect: () => Promise<void>;
};

const globalForPrisma = globalThis as unknown as { prisma: PrismaLike };

function createInMemoryPrisma(): PrismaLike {
  const store: LogEntryRecord[] = [];

  const clone = (entry: LogEntryRecord): LogEntryRecord => ({
    ...entry,
    payload: structuredClone(entry.payload),
    createdAt: new Date(entry.createdAt),
  });

  const sortEntries = (entries: LogEntryRecord[], orderBy?: { id?: 'asc' | 'desc' }) => {
    const direction = orderBy?.id === 'desc' ? -1 : 1;
    return [...entries].sort((left, right) => (left.id - right.id) * direction);
  };

  const delegate = {
    async deleteMany() {
      const count = store.length;
      store.length = 0;
      return { count };
    },
    async findFirst(args?: { orderBy?: { id?: 'asc' | 'desc' } }) {
      const ordered = sortEntries(store, args?.orderBy);
      return ordered.length > 0 ? clone(ordered[0]) : null;
    },
    async findMany(args?: {
      where?: {
        actor?: string;
        eventTime?: { gte?: string; lte?: string };
      };
      orderBy?: { id?: 'asc' | 'desc' };
    }) {
      let entries = [...store];
      if (args?.where?.actor) {
        entries = entries.filter((entry) => entry.actor === args.where?.actor);
      }
      if (args?.where?.eventTime?.gte) {
        entries = entries.filter((entry) => entry.eventTime >= (args.where?.eventTime?.gte as string));
      }
      if (args?.where?.eventTime?.lte) {
        entries = entries.filter((entry) => entry.eventTime <= (args.where?.eventTime?.lte as string));
      }
      return sortEntries(entries, args?.orderBy).map(clone);
    },
    async findUnique(args: { where: { id: number } }) {
      const entry = store.find((item) => item.id === args.where.id);
      return entry ? clone(entry) : null;
    },
    async create(args: { data: Omit<LogEntryRecord, 'id' | 'createdAt'> }) {
      const entry: LogEntryRecord = {
        id: store.length === 0 ? 1 : store[store.length - 1].id + 1,
        createdAt: new Date(),
        ...args.data,
      };
      store.push(entry);
      return clone(entry);
    },
    async update(args: { where: { id: number }; data: Partial<Omit<LogEntryRecord, 'id'>> }) {
      const index = store.findIndex((item) => item.id === args.where.id);
      if (index < 0) {
        throw new Error('Record not found');
      }
      store[index] = {
        ...store[index],
        ...args.data,
      };
      return clone(store[index]);
    },
  };

  const prismaLike: PrismaLike = {
    logEntry: delegate,
    async $transaction<T>(fn: (tx: PrismaLike) => Promise<T>) {
      return fn(prismaLike);
    },
    async $disconnect() {
      return;
    },
  };

  return prismaLike;
}

export const prisma =
  globalForPrisma.prisma ??
  (process.env.NODE_ENV === 'test'
    ? createInMemoryPrisma()
    : new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })) as PrismaLike;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}