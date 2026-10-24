import type { VercelRequest, VercelResponse } from '@vercel/node';

// List of public Piped API instances for server-side resolution
const PIPED_SERVER_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.ducks.party',
  'https://pipedapi.in.projectsegfau.lt',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.kavin.rocks',
  'https://piped-api.lunar.icu',
  'https://pipedapi.palvelintalo.fi',
  'https://pipedapi.mha.fi'
];

async function fetchStreamFromInstance(instance: string, youtubeId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${instance}/streams/${encodeURIComponent(youtubeId)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AuraStream-Vercel/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Resposta não-JSON (possível manutenção/shutdown)');
    }

    if (data && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
      const validStreams = data.audioStreams.filter((s: any) => s && s.url);
      if (validStreams.length === 0) throw new Error('Nenhum stream válido encontrado');

      validStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = validStreams[0];

      return {
        audioUrl: best.url,
        quality: best.quality || `${Math.round((best.bitrate || 128000) / 1000)}kbps`,
        bitrate: best.bitrate || 128000,
        instanceUsed: instance,
        directStreamAvailable: true
      };
    }

    throw new Error('Sem audioStreams na resposta');
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support both /api/streams/[id] (req.query.id) and /api/streams?id=...
  const { id } = req.query;
  const youtubeId = Array.isArray(id) ? id[0] : id;

  if (!youtubeId || typeof youtubeId !== 'string') {
    console.warn('[Vercel Serverless Stream] ⚠️ Requisição inválida: ID do YouTube ausente ou em formato incorreto.');
    return res.status(400).json({ error: 'YouTube ID é obrigatório' });
  }

  const startTime = Date.now();
  console.log(`[Vercel Serverless Stream] 🔍 Iniciando extração em paralelo para YouTube ID: ${youtubeId}`);

  try {
    const result = await Promise.any(
      PIPED_SERVER_INSTANCES.map((instance) => fetchStreamFromInstance(instance, youtubeId))
    );

    const durationMs = Date.now() - startTime;
    console.log(`[Vercel Serverless Stream] ✅ Stream extraído com sucesso via ${result.instanceUsed} em ${durationMs}ms | Quality: ${result.quality}`);

    // Set Cache-Control header for Vercel CDN edge caching (1 hour)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch {
    const durationMs = Date.now() - startTime;
    console.log(`[Vercel Serverless Stream] ℹ️ Stream direto não disponível via Piped após ${durationMs}ms para ${youtubeId}. Acionando YouTube Engine.`);

    return res.status(200).json({
      directStreamAvailable: false,
      audioUrl: null,
      youtubeId,
      message: 'Executando fluxo nativo via YouTube Engine'
    });
  }
}
