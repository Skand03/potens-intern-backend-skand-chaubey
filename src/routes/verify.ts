import { Router } from 'express';
import { verifyChain } from '../lib/verifier';
import { logger } from '../lib/logger';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await verifyChain();
    res.json(result);
  } catch (err) {
    logger.error(err, 'chain verification failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;