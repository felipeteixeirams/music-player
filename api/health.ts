import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authConfigFromEnv } from './_auth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Vercel Serverless Health] 🟢 Checagem de integridade requisitada');
  res.status(200).json({
    status: 'ok',
    environment: 'Vercel Serverless',
    login: authConfigFromEnv() !== null,
    timestamp: new Date().toISOString()
  });
}
