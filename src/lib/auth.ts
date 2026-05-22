import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_KEY || 'potens-dev-key-change-in-production';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
    return;
  }
  next();
}