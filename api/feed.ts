import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDeezerFeed } from './_deezer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const feedData = await buildDeezerFeed();
    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=86400');
    return res.status(200).json(feedData);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao gerar feed', message: err?.message });
  }
}
