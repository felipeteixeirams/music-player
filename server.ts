import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDeezerFeed, searchDeezerTracks } from './api/_deezer';
import { resolveYouTubeVideoIds } from './api/_youtubeSearch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// List of reliable public Piped API instances for server-side resolution
const PIPED_SERVER_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.ducks.party',
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

// In-memory cache for live feed
let liveFeedCache: { data: any; expiresAt: number } | null = null;

// Endpoint: GET /api/feed
// Returns 100% live tracks fetched from integrations for the home feed
app.get('/api/feed', async (req, res) => {
  if (liveFeedCache && liveFeedCache.expiresAt > Date.now()) {
    return res.json({ ...liveFeedCache.data, cached: true });
  }

  const feedData = await buildDeezerFeed();
  const { trending, rock } = feedData;

  if (trending.length > 0 || rock.length > 0) {
    liveFeedCache = {
      data: feedData,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }

  return res.json({ ...feedData, cached: false });
});

// Endpoint: GET /api/search?q={query}
// Searches tracks in the Deezer catalog
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const tracks = await searchDeezerTracks(query.trim(), { style: 'Deezer' });
    return res.json({ tracks, source: 'deezer' });
  } catch (err: any) {
    console.warn(`[Search] Falha na busca Deezer: ${err?.message || err}`);
    return res.json({ tracks: [], source: 'deezer', message: 'Nenhuma faixa online encontrada' });
  }
});

// Endpoint: GET /api/resolve?artist=&title=&duration=
// Finds the YouTube videos that play the full recording of a catalog track
app.get('/api/resolve', async (req, res) => {
  const { artist, title } = req.query;
  const duration = Number(req.query.duration);
  if (typeof artist !== 'string' || !artist.trim() || typeof title !== 'string' || !title.trim()
    || !Number.isFinite(duration) || duration <= 0) {
    return res.status(400).json({ error: 'artist, title and duration are required' });
  }

  try {
    const videoIds = await resolveYouTubeVideoIds(
      { artist: artist.trim(), title: title.trim(), duration },
      { apiKey: process.env.YOUTUBE_API_KEY }
    );
    return res.json({ videoIds });
  } catch (err: any) {
    console.warn(`[Resolve] Falha ao localizar vídeo: ${err?.message || err}`);
    return res.json({ videoIds: [] });
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
