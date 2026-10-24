import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  const query = req.query.q;
  if (!query || typeof query !== 'string' || !query.trim()) {
    console.warn('[Vercel Serverless Search] ⚠️ Parâmetro "q" ausente ou em branco.');
    return res.status(400).json({ error: 'O parâmetro q é obrigatório' });
  }

  const cleanQuery = query.trim();
  const startTime = Date.now();
  console.log(`[Vercel Serverless Search] 🔍 Buscando músicas para: "${cleanQuery}"`);

  // 1. Try YouTube Music InnerTube API first
  try {
    const ytRes = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://music.youtube.com'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20231215.01.00',
            hl: 'pt',
            gl: 'BR'
          }
        },
        query: cleanQuery
      }),
      signal: AbortSignal.timeout(4500)
    });

    if (ytRes.ok) {
      const ytData: any = await ytRes.json();
      const tabs = ytData.contents?.tabbedSearchResultsRenderer?.tabs || [];
      const tracks: any[] = [];

      for (const t of tabs) {
        const sections = t.tabRenderer?.content?.sectionListRenderer?.contents || [];
        for (const s of sections) {
          const shelf = s.musicShelfRenderer;
          if (shelf && shelf.contents) {
            for (const c of shelf.contents) {
              const item = c.musicResponsiveListItemRenderer;
              if (item && item.videoId) {
                const title = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
                const artist = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'YouTube Music';
                const album = item.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Single Oficial';
                const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
                const thumbnail = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';

                if (title && !tracks.some((tr) => tr.sources.youtubeId === item.videoId)) {
                  tracks.push({
                    id: `ytm-${item.videoId}`,
                    title,
                    artist,
                    album,
                    duration: 210,
                    coverUrl: thumbnail,
                    style: 'YouTube Music',
                    categoryId: 'web',
                    sources: {
                      localUrl: '',
                      youtubeId: item.videoId
                    }
                  });
                }
              }
            }
          }
        }
      }

      if (tracks.length > 0) {
        const durationMs = Date.now() - startTime;
        console.log(`[Vercel Serverless Search] ✅ Encontradas ${tracks.length} faixas via YouTube Music InnerTube em ${durationMs}ms`);
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
        return res.status(200).json({ tracks: tracks.slice(0, 15), source: 'YouTube Music InnerTube' });
      }
    }
  } catch (err: any) {
    console.warn(`[Vercel Serverless Search] ℹ️ Falha na busca pelo InnerTube (${err?.message}). Redirecionando para Piped Network...`);
  }

  // 2. Fallback to Piped API instances
  for (const instance of PIPED_SERVER_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(cleanQuery)}&filter=music_songs`,
        {
          signal: AbortSignal.timeout(4000),
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AuraStream/1.0'
          }
        }
      );

      if (!response.ok) continue;

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }

      if (data && Array.isArray(data.items) && data.items.length > 0) {
        const tracks = data.items
          .filter((item: any) => item && item.url && item.title)
          .slice(0, 15)
          .map((item: any) => {
            const rawId = item.url.replace('/watch?v=', '').replace('/streams/', '');
            return {
              id: `piped-${rawId}`,
              title: item.title,
              artist: item.uploaderName || 'Artista Desconhecido',
              album: 'Piped Pure Stream',
              duration: item.duration && item.duration > 0 ? item.duration : 180,
              coverUrl: item.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
              style: 'Online Stream',
              categoryId: 'web',
              sources: {
                localUrl: '',
                youtubeId: rawId
              }
            };
          });

        const durationMs = Date.now() - startTime;
        console.log(`[Vercel Serverless Search] ✅ Encontradas ${tracks.length} faixas via Piped (${instance}) em ${durationMs}ms`);
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
        return res.status(200).json({ tracks, source: instance });
      }
    } catch {
      continue;
    }
  }

  console.log(`[Vercel Serverless Search] ⚠️ Nenhuma faixa online encontrada para "${cleanQuery}"`);
  return res.status(200).json({ tracks: [], message: 'Nenhuma faixa online encontrada' });
}
