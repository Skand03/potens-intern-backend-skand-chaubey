import { Router } from 'express';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';

const router = Router();

router.get('/', async (req, res) => {
  const { from, to, actor } = req.query;

  const where: {
    actor?: string;
    eventTime?: { gte?: string; lte?: string };
  } = {};

  if (typeof actor === 'string' && actor.length > 0) {
    where.actor = actor;
  }

  if ((typeof from === 'string' && from) || (typeof to === 'string' && to)) {
    where.eventTime = {};
    if (typeof from === 'string' && from) where.eventTime.gte = from;
    if (typeof to === 'string' && to) where.eventTime.lte = to;
  }

  try {
    const entries = await prisma.logEntry.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    res.json({ count: entries.length, entries });
  } catch (err) {
    logger.error(err, 'export failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;