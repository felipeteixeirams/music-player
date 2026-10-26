import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guardUser, POLICIES } from './_guard.js';
import { resolveRoute } from './_resolveEndpoint.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const caller = await guardUser(req, res, POLICIES.resolve);
  if (!caller) return;
  const { status, body, cacheControl } = await resolveRoute(req, caller.user);
  // Only successful answers are cacheable, and these are per user (the quota) or per cache state: never shared
  if (cacheControl && status === 200) res.setHeader('Cache-Control', cacheControl);
  return res.status(status).json(body);
}
