import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveYouTubeVideos } from './_youtubeSearch.js';

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

  const startTime = Date.now();
  try {
    const { videoIds, via } = await resolveYouTubeVideos({ artist, title, duration }, { apiKey: process.env.YOUTUBE_API_KEY });
    console.log(`[Resolve] ${videoIds.length > 0 ? '✅' : '⚠️'} "${artist} - ${title}" → ${videoIds.length} vídeo(s) via ${via} em ${Date.now() - startTime}ms`);
    if (videoIds.length > 0) res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ videoIds });
  } catch (err: any) {
    console.warn(`[Resolve] ⚠️ Falha ao localizar vídeo para "${artist} - ${title}": ${err?.message || err}`);
    return res.status(200).json({ videoIds: [] });
  }
}
