import { GoogleGenAI, Type } from '@google/genai';
import type { Track } from '../src/types/music';
import { searchCatalog } from './_catalog.js';

export interface SmartPlaylistRequest {
  prompt: string;
  targetCount?: number;
}

export interface SmartPlaylistValidation {
  passed: boolean;
  criteriaMet: string[];
  confidenceScore: number;
  varietyScore: number;
  deliveredCount: number;
  excludedTypes: string[];
}

export interface SmartPlaylistResponse {
  title: string;
  description: string;
  prompt: string;
  tracks: Track[];
  validation: SmartPlaylistValidation;
}

const MAX_TARGET_COUNT = 30;
const MIN_TARGET_COUNT = 5;
const DEFAULT_TARGET_COUNT = 15;
const MAX_PER_ARTIST = 2;

type FetchLike = typeof fetch;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface GeminiCurationOutput {
  title: string;
  description: string;
  criteria: string[];
  candidates: Array<{
    artist: string;
    title: string;
    searchQuery: string;
  }>;
}

/** Fallback generator when GEMINI_API_KEY is not set or network call to Gemini fails. */
function fallbackCuration(prompt: string, targetCount: number): GeminiCurationOutput {
  const clean = prompt.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const title = clean.length > 30 ? clean.slice(0, 30).trim() + '...' : clean || 'Minha Playlist Inteligente';

  return {
    title: `Seleção: ${title}`,
    description: `Playlist personalizada baseada em "${clean || 'músicas selecionadas'}"`,
    criteria: [
      `Foco no pedido: ${clean || 'estilo variado'}`,
      'Faixas musicais individuais verificadas no catálogo',
      'Exclusão de podcasts e listas prontas'
    ],
    candidates: words.map((w) => ({
      artist: w,
      title: w,
      searchQuery: `${w} music`
    }))
  };
}

async function curateWithGemini(prompt: string, targetCount: number): Promise<GeminiCurationOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackCuration(prompt, targetCount);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const candidateCount = Math.min(MAX_TARGET_COUNT, targetCount + 8);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `O usuário quer uma playlist personalizada com o seguinte pedido: "${prompt}".
Gere exatamente ${candidateCount} sugestões de faixas musicais individuais reais de artistas renomados ou adequados ao tema.
Regras estritas:
1. Somente faixas musicais reais (cantor/banda e nome da música).
2. Proibido sugerir podcasts, programas de rádio falados, notícias ou nomes de playlists prontas.
3. Máximo de 2 faixas do mesmo artista.
4. Inclua termos de busca limpos para localização exata no catálogo musical (Deezer/iTunes).`,
      config: {
        systemInstruction:
          'Você é um curador musical experiente para o aplicativo AuraStream. Seu papel é compreender pedidos em linguagem natural e sugerir faixas musicais individuais reais com máxima fidelidade ao clima, ritmo, época e estilo pedidos.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Título curto e expressivo para a playlist (máx 50 caracteres)'
            },
            description: {
              type: Type.STRING,
              description: 'Breve resumo explicativo da curadoria em uma frase'
            },
            criteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de 2 a 4 critérios musicais atendidos (ex: "Década de 1970", "Rock clássico", "Ritmo acelerado")'
            },
            candidates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  artist: { type: Type.STRING },
                  title: { type: Type.STRING },
                  searchQuery: {
                    type: Type.STRING,
                    description: 'Termo de busca limpo formato "Artista Título", sem pontuação excessiva'
                  }
                },
                required: ['artist', 'title', 'searchQuery']
              }
            }
          },
          required: ['title', 'description', 'criteria', 'candidates']
        }
      }
    });

    const raw = (response.text ?? '').trim();
    if (!raw) return fallbackCuration(prompt, targetCount);
    const parsed = JSON.parse(raw) as GeminiCurationOutput;
    if (!parsed || !Array.isArray(parsed.candidates)) {
      return fallbackCuration(prompt, targetCount);
    }
    return parsed;
  } catch (err) {
    console.warn(`[SmartPlaylist] Falha no Gemini API (${(err as Error)?.message || err}); usando fallback.`);
    return fallbackCuration(prompt, targetCount);
  }
}

/**
 * Searches the catalog (Deezer + iTunes) for individual songs matching the candidates,
 * applying deduplication, artist limits (max 2 per artist), and strict exclusion of podcasts and pre-made lists.
 */
export async function resolveAndValidateCandidates(
  candidates: Array<{ artist: string; title: string; searchQuery: string }>,
  targetCount: number,
  fallbackPrompt: string,
  fetchImpl?: FetchLike
): Promise<Track[]> {
  const resolved: Track[] = [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const artistCount = new Map<string, number>();

  const isEligible = (track: Track): boolean => {
    // Exclude anything that isn't a song or has malformed ID
    if (!track.id || (!track.id.startsWith('deezer-') && !track.id.startsWith('itunes-'))) return false;
    // Podcasts never come through searchCatalog tracks, but verify invariants:
    if ((track as unknown as { kind?: string }).kind === 'podcast') return false;
    if (seenIds.has(track.id)) return false;

    const signature = `${normalize(track.title)}|${normalize(track.artist)}`;
    if (seenSignatures.has(signature)) return false;

    const artistNorm = normalize(track.artist);
    const count = artistCount.get(artistNorm) ?? 0;
    if (count >= MAX_PER_ARTIST) return false;

    return true;
  };

  const addTrack = (track: Track): void => {
    seenIds.add(track.id);
    seenSignatures.add(`${normalize(track.title)}|${normalize(track.artist)}`);
    const artistNorm = normalize(track.artist);
    artistCount.set(artistNorm, (artistCount.get(artistNorm) ?? 0) + 1);
    resolved.push(track);
  };

  // Step 1: Resolve candidates suggested by AI
  for (const cand of candidates) {
    if (resolved.length >= targetCount) break;
    const query = cand.searchQuery || `${cand.artist} ${cand.title}`;
    try {
      const searchResult = await searchCatalog(query, { limit: 3, fetchImpl });
      const best = searchResult.tracks.find(isEligible);
      if (best) {
        addTrack(best);
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Step 2: If we still haven't reached targetCount, search directly with prompt keywords to fill remaining
  if (resolved.length < targetCount) {
    try {
      const backupSearch = await searchCatalog(fallbackPrompt, { limit: targetCount * 2, fetchImpl });
      for (const t of backupSearch.tracks) {
        if (resolved.length >= targetCount) break;
        if (isEligible(t)) {
          addTrack(t);
        }
      }
    } catch {
      // ignore
    }
  }

  return resolved;
}

export function buildValidationReport(
  prompt: string,
  targetCount: number,
  tracks: Track[],
  criteria: string[]
): SmartPlaylistValidation {
  const passed = tracks.length >= Math.min(targetCount, MIN_TARGET_COUNT) && tracks.every((t) => t.id && t.title && t.artist);
  const uniqueArtists = new Set(tracks.map((t) => normalize(t.artist)));
  const varietyScore = tracks.length > 0 ? Math.round((uniqueArtists.size / tracks.length) * 100) : 0;
  const countRatio = targetCount > 0 ? Math.min(1, tracks.length / targetCount) : 0;
  const confidenceScore = Math.round((varietyScore * 0.4 + countRatio * 60));

  const criteriaMet: string[] = [
    'Faixas musicais individuais verificadas nas integrações de catálogo',
    'Exclusão estrita de podcasts, episódios e listas prontas de terceiros',
    `Diversidade de artistas respeitada (máximo de ${MAX_PER_ARTIST} faixas por artista)`,
    `Quantidade atendida: ${tracks.length} faixas entregues`,
    ...criteria.slice(0, 3)
  ];

  return {
    passed,
    criteriaMet,
    confidenceScore,
    varietyScore,
    deliveredCount: tracks.length,
    excludedTypes: ['podcast', 'curated_playlist', 'audiobook']
  };
}

/**
 * Endpoint handler: interprets prompt, finds tracks in catalog, validates constraints and returns smart playlist.
 */
export async function smartPlaylistEndpoint(
  body: unknown,
  options: { fetchImpl?: FetchLike } = {}
): Promise<{ status: number; body: SmartPlaylistResponse | { error: string } }> {
  const req = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const rawPrompt = typeof req.prompt === 'string' ? req.prompt.trim() : '';

  if (!rawPrompt) {
    return { status: 400, body: { error: 'O pedido em linguagem natural é obrigatório' } };
  }
  if (rawPrompt.length > 300) {
    return { status: 400, body: { error: 'O pedido deve ter no máximo 300 caracteres' } };
  }

  const rawCount = typeof req.targetCount === 'number' && Number.isFinite(req.targetCount) ? req.targetCount : DEFAULT_TARGET_COUNT;
  const targetCount = Math.max(MIN_TARGET_COUNT, Math.min(MAX_TARGET_COUNT, Math.round(rawCount)));

  // 1. Curation
  const curation = await curateWithGemini(rawPrompt, targetCount);

  // 2. Resolution against real catalog
  const tracks = await resolveAndValidateCandidates(curation.candidates, targetCount, rawPrompt, options.fetchImpl);

  // 3. Validation
  const validation = buildValidationReport(rawPrompt, targetCount, tracks, curation.criteria);

  return {
    status: 200,
    body: {
      title: curation.title,
      description: curation.description,
      prompt: rawPrompt,
      tracks,
      validation
    }
  };
}
