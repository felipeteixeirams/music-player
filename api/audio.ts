import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AudioProxyError, fetchAllowedAudio } from './_audioProxy.js';
import { guard, POLICIES } from './_guard.js';

// Same-origin copy of a catalog preview so the browser can store it for offline playback (the CDN sends no CORS headers).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guard(req, res, POLICIES.audio)) return;
  try {
    const { contentType, body } = await fetchAllowedAudio(req.query.url);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(body);
  } catch (err: any) {
    const status = err instanceof AudioProxyError ? err.status : 502;
    return res.status(status).json({ error: err?.message || 'Falha ao obter o áudio' });
  }
}
