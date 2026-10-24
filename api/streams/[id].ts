import type { VercelRequest, VercelResponse } from '@vercel/node';

// List of reliable public Piped API instances for server-side resolution
const PIPED_SERVER_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://piped-api.lunar.icu',
  'https://pipedapi.tokhmi.xyz',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.drgns.space',
  'https://watch.leptons.xyz/api',
  'https://pipedapi.leptons.xyz'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support both /api/streams/[id] (req.query.id) and /api/streams?id=...
  const { id } = req.query;
  const youtubeId = Array.isArray(id) ? id[0] : id;

  if (!youtubeId || typeof youtubeId !== 'string') {
    console.warn('[Vercel Serverless Stream] ⚠️ Requisição inválida: ID do YouTube ausente ou em formato incorreto.');
    return res.status(400).json({ error: 'YouTube ID é obrigatório' });
  }

  const startTime = Date.now();
  console.log(`[Vercel Serverless Stream] 🔍 Iniciando extração de áudio para YouTube ID: ${youtubeId}`);

  // Query Piped instances server-side with fallback
  for (const instance of PIPED_SERVER_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${instance}/streams/${encodeURIComponent(youtubeId)}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AuraStream-Vercel/1.0'
        }
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[Vercel Serverless Stream] ℹ️ Instância ${instance} retornou HTTP ${response.status} para ${youtubeId}`);
        continue;
      }

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn(`[Vercel Serverless Stream] ⚠️ Instância ${instance} retornou resposta não-JSON (possível manutenção/shutdown)`);
        continue;
      }

      if (data && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
        const validStreams = data.audioStreams.filter((s: any) => s && s.url);
        if (validStreams.length === 0) continue;

        validStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        const best = validStreams[0];

        const result = {
          audioUrl: best.url,
          quality: best.quality || `${Math.round((best.bitrate || 128000) / 1000)}kbps`,
          bitrate: best.bitrate || 128000,
          instanceUsed: instance,
          directStreamAvailable: true
        };

        const durationMs = Date.now() - startTime;
        console.log(`[Vercel Serverless Stream] ✅ Stream extraído com sucesso via ${instance} em ${durationMs}ms | Quality: ${result.quality}`);

        // Set Cache-Control header for Vercel CDN edge caching (1 hour)
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json(result);
      }
    } catch (err: any) {
      console.warn(`[Vercel Serverless Stream] ⚠️ Falha na conexão com ${instance}: ${err?.message || err}`);
      continue;
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Vercel Serverless Stream] ℹ️ Stream direto não disponível via Piped após ${durationMs}ms para ${youtubeId}. Acionando YouTube Engine.`);

  return res.status(200).json({
    directStreamAvailable: false,
    audioUrl: null,
    youtubeId,
    message: 'Executando fluxo nativo via YouTube Engine'
  });
}
