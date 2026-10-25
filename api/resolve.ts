import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveYouTubeVideoIds } from './_youtubeSearch.js';

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.length <= 200 ? value.trim() : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const artist = readText(req.query.artist);
  const title = readText(req.query.title);
  const duration = Number(req.query.duration);
  if (!artist || !title || !Number.isFinite(duration) || duration <= 0) {
    return res.status(400).json({ error: 'Os parâmetros artist, title e duration são obrigatórios' });
  }

  try {
    const videoIds = await resolveYouTubeVideoIds({ artist, title, duration }, { apiKey: process.env.YOUTUBE_API_KEY });
    if (videoIds.length > 0) res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ videoIds });
  } catch (err: any) {
    console.warn(`[Resolve] ⚠️ Falha ao localizar vídeo para "${artist} - ${title}": ${err?.message || err}`);
    return res.status(200).json({ videoIds: [] });
  }
}
