import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchCatalog } from './_catalog.js';

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
    const result = await searchCatalog(cleanQuery);
    console.log(`[Vercel Serverless Search] ✅ ${result.tracks.length} faixas via ${result.source} em ${Date.now() - startTime}ms`);
    if (result.tracks.length > 0) res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(result);
  } catch (err: any) {
    console.warn(`[Vercel Serverless Search] ⚠️ Falha em todos os catálogos: ${err?.message || err}`);
    return res.status(200).json({ tracks: [], source: 'deezer', message: 'Nenhuma faixa online encontrada' });
  }
}
