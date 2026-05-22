import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/client';
import { computeHash } from '../lib/hasher';
import { verifyEntry } from '../lib/verifier';
import { logger } from '../lib/logger';

const router = Router();

const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Try again later.' },
});

router.post('/', postLimiter, async (req, res) => {
  const { actor, action, payload } = req.body;

  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor is required and must be a string' });
    return;
  }
  if (!action || typeof action !== 'string') {
    res.status(400).json({ error: 'action is required and must be a string' });
    return;
  }
  if (payload === undefined) {
    res.status(400).json({ error: 'payload is required' });
    return;
  }

  const eventTime = new Date().toISOString();

  try {
    const entry = await prisma.$transaction(async (tx: any) => {
      const last = await tx.logEntry.findFirst({ orderBy: { id: 'desc' } });
      const previousHash = last ? last.currentHash : '0';
      const currentHash = computeHash(previousHash, actor, action, payload, eventTime);
      return tx.logEntry.create({
        data: { actor, action, payload, eventTime, previousHash, currentHash },
      });
    });

    logger.info({ id: entry.id, actor, action }, 'log entry appended');
    res.status(201).json(entry);
  } catch (err) {
    logger.error(err, 'failed to append log entry');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ error: 'id must be a positive integer' });
    return;
  }

  try {
    const entry = await prisma.logEntry.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    const verification = await verifyEntry(id);
    res.json({ entry, verification });
  } catch (err) {
    logger.error(err, 'failed to fetch log entry');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;