import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AudioProxyError, fetchAllowedAudio, fetchAllowedImage } from './_mediaProxy.js';
import { guard, POLICIES } from './_guard.js';

/**
 * Same-origin copies of catalog media. `?kind=image&url=` is a cover (for a network that blocks the CDN's domain);
 * `?url=` alone is a preview (the old `/api/audio`, which `vercel.json` still routes here).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isImage = req.query.kind === 'image';
  if (!(await guard(req, res, isImage ? POLICIES.media : POLICIES.audio))) return;
  try {
    if (isImage) {
      const { contentType, body } = await fetchAllowedImage(req.query.url);
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // A cover's address is fixed by its content: the CDN of the platform keeps it long, the browser a week
      res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400');
      return res.status(200).send(body);
    }
    const { contentType, body } = await fetchAllowedAudio(req.query.url);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(body);
  } catch (err: any) {
    const status = err instanceof AudioProxyError ? err.status : 502;
    return res.status(status).json({ error: err?.message || 'Falha ao obter o arquivo' });
  }
}
