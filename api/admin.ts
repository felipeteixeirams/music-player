import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guardUser, POLICIES } from './_guard.js';
import { adminEndpoint } from './_adminEndpoint.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const caller = await guardUser(req, res, POLICIES.catalog);
  if (!caller) return;
  const { status, body } = await adminEndpoint(req.query, caller.user);
  // Per person and holds e-mails: never cached
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(status).json(body);
}
