import 'dotenv/config';
import express from 'express';
import { apiKeyAuth } from './lib/auth';
import { logger } from './lib/logger';
import logRouter from './routes/log';
import verifyRouter from './routes/verify';
import exportRouter from './routes/export';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

app.use('/log', apiKeyAuth, logRouter);
app.use('/verify', apiKeyAuth, verifyRouter);
app.use('/export', apiKeyAuth, exportRouter);

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(PORT, () => logger.info(`server started on port ${PORT}`));
}

export default app;