import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// List of reliable public Piped API instances for server-side resolution
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

// In-memory cache for extracted audio stream manifests (TTL: 4 hours)
interface CachedStream {
  data: {
    audioUrl: string;
    quality: string;
    bitrate: number;
    instanceUsed: string;
  };
  expiresAt: number;
}
const streamCache = new Map<string, CachedStream>();

async function fetchStreamFromInstance(instance: string, youtubeId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${instance}/streams/${encodeURIComponent(youtubeId)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AuraStream-Server/1.0'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON');
    }

    if (data && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
      const validStreams = data.audioStreams.filter((s: any) => s && s.url);
      if (validStreams.length === 0) throw new Error('No valid streams');

      validStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = validStreams[0];

      return {
        audioUrl: best.url,
        quality: best.quality || `${Math.round((best.bitrate || 128000) / 1000)}kbps`,
        bitrate: best.bitrate || 128000,
        instanceUsed: instance
      };
    }
    throw new Error('No audio streams');
  } finally {
    clearTimeout(timeout);
  }
}

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
      throw new Error('Invalid JSON');
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
            coverUrl: item.thumbnail || '/icon.svg',
            style: 'Online Stream',
            categoryId: 'web',
            sources: {
              localUrl: '',
              youtubeId: rawId
            }
          };
        });

      if (tracks.length === 0) throw new Error('No valid tracks');
      return { tracks, source: instance };
    }
    throw new Error('No items');
  } finally {
    clearTimeout(timeout);
  }
}

// Endpoint: GET /api/streams/:id
// Resolves pure audio stream without CORS restrictions and caches result
app.get('/api/streams/:id', async (req, res) => {
  const youtubeId = req.params.id;
  if (!youtubeId || typeof youtubeId !== 'string') {
    return res.status(400).json({ error: 'YouTube ID is required' });
  }

  // Check cache first
  const cached = streamCache.get(youtubeId);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ ...cached.data, cached: true });
  }

  // Query Piped instances server-side in parallel
  try {
    const result = await Promise.any(
      PIPED_SERVER_INSTANCES.map((instance) => fetchStreamFromInstance(instance, youtubeId))
    );

    // Cache for 4 hours
    streamCache.set(youtubeId, {
      data: result,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000
    });

    console.log(`[Piped Server] ✅ Extracted direct audio stream for ${youtubeId}: ${result.audioUrl} (${result.quality})`);
    return res.json({ ...result, cached: false });
  } catch {
    console.log(`[Piped Server] ℹ️ Direct stream manifest unavailable for ${youtubeId}; delegating to authentic YouTube engine`);
    return res.json({
      directStreamAvailable: false,
      audioUrl: null,
      youtubeId,
      message: 'Using authentic YouTube headless audio stream'
    });
  }
});

// Endpoint: GET /api/search?q={query}
// Searches live tracks via YouTube Music InnerTube API with Piped fallback
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  const cleanQuery = query.trim();

  // 1. Try YouTube Music InnerTube API first
  try {
    const ytRes = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
      const ytData = await ytRes.json();
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
                const album = item.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Official Single';
                const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
                const thumbnail = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '/icon.svg';

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
        console.log(`[YouTube Music Search] ✅ Found ${tracks.length} official tracks for "${cleanQuery}"`);
        return res.json({ tracks: tracks.slice(0, 15), source: 'YouTube Music InnerTube' });
      }
    }
  } catch (err) {
    console.warn('YouTube Music InnerTube search notice, falling back to Piped:', err);
  }

  // 2. Parallel Fallback to Piped API instances
  try {
    const result = await Promise.any(
      PIPED_SERVER_INSTANCES.map((instance) => searchPipedInstance(instance, cleanQuery))
    );
    return res.json(result);
  } catch {
    return res.json({ tracks: [], message: 'No online tracks found' });
  }
});

// Endpoint: GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cachedStreams: streamCache.size,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

async function start() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // In dev: mount Vite middleware for instant compilation
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {}
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`AuraStream Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
