import type { VercelRequest, VercelResponse } from '@vercel/node';
import { feedEndpoint } from './_endpoints.js';
import { guard, POLICIES } from './_guard.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { status, body, cacheControl } = await feedEndpoint();
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  return res.status(status).json(body);
}
