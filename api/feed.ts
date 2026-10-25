import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractYouTubeId } from './_youtubeId.js';

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

async function searchPipedInstance(instance: string, cleanQuery: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(
      `${instance}/search?q=${encodeURIComponent(cleanQuery)}&filter=music_songs`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AuraStream/1.0'
        }
      }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Resposta não-JSON');
    }

    if (data && Array.isArray(data.items) && data.items.length > 0) {
      const tracks = data.items
        .filter((item: any) => item && item.url && item.title && extractYouTubeId(item.url))
        .slice(0, 15)
        .map((item: any) => {
          const rawId = extractYouTubeId(item.url)!;
          return {
            id: `piped-${rawId}`,
            title: item.title,
            artist: item.uploaderName || 'Artista Desconhecido',
            album: 'Single Oficial',
            duration: item.duration && item.duration > 0 ? item.duration : 180,
            coverUrl: rawId ? `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg` : (item.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'),
            style: 'Online Stream',
            categoryId: 'web',
            sources: {
              localUrl: '',
              youtubeId: rawId
            }
          };
        });

      if (tracks.length === 0) throw new Error('Sem faixas válidas');
      return { tracks, source: instance };
    }

    throw new Error('Sem resultados na instância');
  } finally {
    clearTimeout(timeout);
  }
}

async function executeLiveTrackSearch(cleanQuery: string, defaultStyle = 'Online Stream'): Promise<{ tracks: any[]; source: string }> {
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
      signal: AbortSignal.timeout(2500)
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
                const artist = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Artista Desconhecido';
                const album = item.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Single Oficial';
                const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
                const thumbnail = item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : (thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500');

                if (title && !tracks.some((tr) => tr.sources.youtubeId === item.videoId)) {
                  tracks.push({
                    id: `ytm-${item.videoId}`,
                    title,
                    artist,
                    album,
                    duration: 210,
                    coverUrl: thumbnail,
                    style: defaultStyle,
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
        return { tracks: tracks.slice(0, 15), source: 'YouTube Music InnerTube' };
      }
    }
  } catch (err: any) {
    console.warn(`[Vercel Feed Search] ℹ️ Falha InnerTube (${err?.message}). Usando Piped...`);
  }

  // 2. Parallel Fallback to Piped API instances
  try {
    const result = await Promise.any(
      PIPED_SERVER_INSTANCES.map((instance) => searchPipedInstance(instance, cleanQuery))
    );
    return result;
  } catch {
    return { tracks: [], source: 'None' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const [trendingRes, rockRes, popRes, lofiRes] = await Promise.allSettled([
      executeLiveTrackSearch('Top Hits Brasil 2026', 'Top Hits'),
      executeLiveTrackSearch('Classic Rock Hits Queen AC/DC', 'Classic Rock'),
      executeLiveTrackSearch('Alternative Pop Imagine Dragons', 'Alternative Pop'),
      executeLiveTrackSearch('Lofi Chill Beats Study', 'Lofi Chill')
    ]);

    const trending = trendingRes.status === 'fulfilled' ? trendingRes.value.tracks : [];
    const rock = rockRes.status === 'fulfilled' ? rockRes.value.tracks : [];
    const pop = popRes.status === 'fulfilled' ? popRes.value.tracks : [];
    const lofi = lofiRes.status === 'fulfilled' ? lofiRes.value.tracks : [];

    const feedData = {
      trending,
      rock,
      pop,
      lofi,
      featured: trending[0] || rock[0] || null
    };

    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=86400');
    return res.status(200).json(feedData);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao gerar feed', message: err?.message });
  }
}
