import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchDeezerTracks } from './_deezer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || !query.trim()) {
    console.warn('[Vercel Serverless Search] ⚠️ Parâmetro "q" ausente ou em branco.');
    return res.status(400).json({ error: 'O parâmetro q é obrigatório' });
  }

  const cleanQuery = query.trim();
  const startTime = Date.now();
  console.log(`[Vercel Serverless Search] 🔍 Buscando músicas para: "${cleanQuery}"`);

  try {
    const tracks = await searchDeezerTracks(cleanQuery, { style: 'Deezer' });
    console.log(`[Vercel Serverless Search] ✅ ${tracks.length} faixas via Deezer em ${Date.now() - startTime}ms`);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ tracks, source: 'deezer' });
  } catch (err: any) {
    console.warn(`[Vercel Serverless Search] ⚠️ Falha na busca Deezer: ${err?.message || err}`);
    return res.status(200).json({ tracks: [], source: 'deezer', message: 'Nenhuma faixa online encontrada' });
  }
}
