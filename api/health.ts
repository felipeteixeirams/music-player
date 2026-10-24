import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Vercel Serverless Health] 🟢 Checagem de integridade requisitada');
  res.status(200).json({
    status: 'ok',
    environment: 'Vercel Serverless',
    timestamp: new Date().toISOString()
  });
}
