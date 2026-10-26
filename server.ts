import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { categoryEndpoint, feedEndpoint, radioEndpoint, searchEndpoint } from './api/_endpoints';
import { AudioProxyError, fetchAllowedAudio } from './api/_audioProxy';
import { resolveRoute } from './api/_resolveEndpoint';
import { healthBody } from './api/_healthEndpoint';
import { reportStartupOnce } from './api/_config';
import { authorizeRequest, POLICIES, type GuardPolicy } from './api/_guard';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Same protection as the Vercel functions: same-origin pages only, a per-address rate limit and a signed-in user
const policyFor = (path: string): GuardPolicy | null =>
  path.startsWith('/health') ? null
  : path.startsWith('/resolve') ? POLICIES.resolve
  : path.startsWith('/audio') ? POLICIES.audio
  : POLICIES.catalog;
app.use('/api', async (req, res, next) => {
  const policy = policyFor(req.path);
  if (!policy) return next();
  const decision = await authorizeRequest(req.headers, policy, { method: req.method, url: req.originalUrl });
  if (decision.ok) {
    res.locals.user = decision.user ?? null;
    return next();
  }
  if (decision.retryAfterSeconds) res.setHeader('Retry-After', String(decision.retryAfterSeconds));
  return res.status(decision.status).json({ error: decision.message, ...(decision.code ? { code: decision.code } : {}) });
});

// In-memory cache for the home feed
let liveFeedCache: { data: unknown; expiresAt: number } | null = null;

// Endpoint: GET /api/feed
// First page of every home category
app.get('/api/feed', async (req, res) => {
  if (liveFeedCache && liveFeedCache.expiresAt > Date.now()) {
    return res.json(liveFeedCache.data);
  }

  const { status, body } = await feedEndpoint();
  if (status === 200) {
    liveFeedCache = { data: body, expiresAt: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  return res.status(status).json(body);
});

// Endpoint: GET /api/category?id=&index=&limit=
// One page of a home category
app.get('/api/category', async (req, res) => {
  const { status, body } = await categoryEndpoint(req.query);
  return res.status(status).json(body);
});

// Endpoint: GET /api/radio and GET /api/radio?id=
// Curated stations by genre, or a fresh batch of tracks from one station
app.get('/api/radio', async (req, res) => {
  const { status, body } = await radioEndpoint(req.query);
  return res.status(status).json(body);
});

// Endpoint: GET /api/search?q={query}&index=&limit=
// One page of search results from the catalog
app.get('/api/search', async (req, res) => {
  const { status, body } = await searchEndpoint(req.query);
  return res.status(status).json(body);
});

// Endpoint: GET /api/audio?url=
// Same-origin copy of a catalog preview, so the browser can store it for offline playback
app.get('/api/audio', async (req, res) => {
  try {
    const { contentType, body } = await fetchAllowedAudio(req.query.url);
    res.setHeader('Content-Type', contentType);
    return res.send(body);
  } catch (err: any) {
    const status = err instanceof AudioProxyError ? err.status : 502;
    return res.status(status).json({ error: err?.message || 'Falha ao obter o áudio' });
  }
});

// Endpoint: GET /api/resolve?id=&artist=&title=&duration= (also ?usage=1 and POST to report a broken video)
// Finds the YouTube videos that play the full recording of a catalog track, through the shared cache and the daily quota
app.all('/api/resolve', async (req, res) => {
  const { status, body, cacheControl } = await resolveRoute(req, res.locals.user ?? null);
  if (cacheControl && status === 200) res.setHeader('Cache-Control', cacheControl);
  return res.status(status).json(body);
});

// Endpoint: GET /api/health (and ?deep=1: also asks the services whether the configuration works)
app.get('/api/health', async (req, res) => {
  res.json(await healthBody(req.query.deep !== undefined, { uptimeSeconds: Math.floor(process.uptime()) }));
});

async function start() {
  reportStartupOnce();
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
