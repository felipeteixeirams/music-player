import type { VercelRequest, VercelResponse } from '@vercel/node';
import { healthBody } from './_healthEndpoint.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Vercel Serverless Health] 🟢 Checagem de integridade requisitada');
  res.status(200).json(await healthBody(req.query.deep !== undefined, { environment: 'Vercel Serverless', timestamp: new Date().toISOString() }));
}
