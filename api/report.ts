import type { VercelRequest, VercelResponse } from '@vercel/node';
import { reportEndpoint } from './_reportEndpoint.js';
import { authorizeReport } from './_guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (req.headers) {
    const decision = await authorizeReport(req.headers, { method: req.method, url: req.url });
    if (decision.requestId) res.setHeader('X-Request-Id', decision.requestId);
    if (!decision.ok) {
      if (decision.retryAfterSeconds) res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      return res.status(decision.status).json({ error: decision.message });
    }
  }
  const { status, body } = reportEndpoint(req.body);
  return status === 204 ? res.status(204).end() : res.status(status).json(body);
}
