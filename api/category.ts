import type { VercelRequest, VercelResponse } from '@vercel/node';
import { categoryEndpoint } from './_endpoints.js';
import { guard, POLICIES } from './_guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await guard(req, res, POLICIES.catalog))) return;
  const { status, body, cacheControl } = await categoryEndpoint(req.query);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  return res.status(status).json(body);
}
