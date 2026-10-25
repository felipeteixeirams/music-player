import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchEndpoint } from './_endpoints.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { status, body, cacheControl } = await searchEndpoint(req.query);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  return res.status(status).json(body);
}
