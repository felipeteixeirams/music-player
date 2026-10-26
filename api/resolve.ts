import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeResolution, MAX_TRACK_DURATION_SECONDS, resolveYouTubeVideos } from './_youtubeSearch.js';
import { guard, POLICIES } from './_guard.js';

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.length <= 200 ? value.trim() : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guard(req, res, POLICIES.resolve)) return;
  const artist = readText(req.query.artist);
  const title = readText(req.query.title);
  const duration = Number(req.query.duration);
  if (!artist || !title || !Number.isFinite(duration) || duration <= 0 || duration > MAX_TRACK_DURATION_SECONDS) {
    return res.status(400).json({ error: 'Os parâmetros artist, title e duration são obrigatórios' });
  }

  const startTime = Date.now();
  try {
    const query = { artist, title, duration };
    const result = await resolveYouTubeVideos(query, { apiKey: process.env.YOUTUBE_API_KEY });
    const { videoIds } = result;
    console.log(`[Resolve] ${describeResolution(query, result, Date.now() - startTime)}`);
    // An answer of "no video" is cached for an hour too, or each replay of such a track would repeat the paid search; a failure (below) is never cached
    res.setHeader('Cache-Control', videoIds.length > 0 ? 's-maxage=86400, stale-while-revalidate=604800' : 's-maxage=3600');
    return res.status(200).json({ videoIds });
  } catch (err: any) {
    console.warn(`[Resolve] ⚠️ Falha ao localizar vídeo para "${artist} - ${title}": ${err?.message || err}`);
    return res.status(200).json({ videoIds: [] });
  }
}
