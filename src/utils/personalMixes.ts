import type { Track, TrackPage } from '../types/music';
import type { PlayEntry } from './playHistory';

/**
 * The personal cards at the top of the home ("Escolhidos para você"): playlists made from what this person plays and
 * likes. Pure rules only; where the artists' tracks come from is in `personalMixSources.ts`. Each mix is the same all
 * day (seeded by the date), so one that is playing does not reshuffle under the listener's finger.
 */

export type MixKind = 'for-you' | 'mood' | 'discovery' | 'favorites' | 'rediscover';

export interface PersonalMix {
  id: MixKind;
  /** Small line on the card: "Feito para você", "Humor para você". */
  label: string;
  title: string;
  description: string;
  tracks: Track[];
  /** Card colors, light to dark. */
  colors: [string, string];
}

/** A mix needs this many tracks to be worth a card. */
export const MIN_MIX_TRACKS = 8;
export const MAX_MIX_TRACKS = 30;
const MIN_FAVORITES = 5;
const MIN_MOOD_TRACKS = 3;
const REDISCOVER_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_WEIGHT_MS = 30 * 24 * 60 * 60 * 1000;

/** The calendar day on the device, "2026-10-28": a new mix every day. */
export function dayKey(now: number): string {
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** The same order for the same seed (mulberry32), so a mix keeps its order all day. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  let state = hash(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const normalizeName = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface RankedArtist {
  name: string;
  /** Plays, counting the last 30 days double. */
  score: number;
}

/** The artists played most, best first (ties by name). Several artists on one track count for the first name. */
export function rankArtists(entries: PlayEntry[], now: number, limit = 5): RankedArtist[] {
  const scores = new Map<string, RankedArtist>();
  for (const entry of entries) {
    const name = entry.track.artist.split(/\s*(?:,|&| feat\.? | ft\.? )\s*/i)[0]?.trim();
    if (!name) continue;
    const key = normalizeName(name);
    const weight = now - entry.playedAt <= RECENT_WEIGHT_MS ? 2 : 1;
    const current = scores.get(key);
    if (current) current.score += weight;
    else scores.set(key, { name, score: weight });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

/** One track from each list in turn, no repeats, up to `limit`: a mix that moves between artists. */
export function interleave(lists: Track[][], limit = MAX_MIX_TRACKS, exclude: ReadonlySet<string> = new Set()): Track[] {
  const seen = new Set<string>(exclude);
  const result: Track[] = [];
  for (let round = 0; result.length < limit; round += 1) {
    let any = false;
    for (const list of lists) {
      if (round >= list.length) continue;
      any = true;
      const track = list[round];
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      result.push(track);
      if (result.length >= limit) break;
    }
    if (!any) break;
  }
  return result;
}

const listNames = (names: string[]): string => {
  const shown = names.slice(0, 3);
  if (shown.length <= 1) return shown[0] ?? '';
  return `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
};

export function buildForYou(names: string[], tops: Track[][], day: string): PersonalMix | null {
  const tracks = seededShuffle(interleave(tops, MAX_MIX_TRACKS), `for-you:${day}`).slice(0, MAX_MIX_TRACKS);
  if (tracks.length < MIN_MIX_TRACKS) return null;
  return {
    id: 'for-you',
    label: 'Feito para você',
    title: 'Mix para você',
    description: `O que você mais ouve: ${listNames(names)} e mais.`,
    tracks,
    colors: ['#ff453a', '#9d1c2b']
  };
}

export function buildDiscovery(names: string[], tops: Track[][], played: ReadonlySet<string>, day: string): PersonalMix | null {
  const tracks = seededShuffle(interleave(tops, MAX_MIX_TRACKS, played), `discovery:${day}`);
  if (tracks.length < MIN_MIX_TRACKS) return null;
  return {
    id: 'discovery',
    label: 'Feito para você',
    title: 'Estação de descoberta',
    description: `Artistas parecidos com os seus, como ${listNames(names)}.`,
    tracks,
    colors: ['#5e5ce6', '#2b2a7a']
  };
}

export function buildFavorites(liked: Track[], day: string): PersonalMix | null {
  if (liked.length < MIN_FAVORITES) return null;
  return {
    id: 'favorites',
    label: 'Feito para você',
    title: 'Seus favoritos',
    description: 'As músicas que você curtiu, em uma ordem nova a cada dia.',
    tracks: seededShuffle(liked, `favorites:${day}`).slice(0, MAX_MIX_TRACKS),
    colors: ['#ff375f', '#8e1d3a']
  };
}

/** What was played more than two weeks ago and not since. */
export function buildRediscover(entries: PlayEntry[], now: number, day: string): PersonalMix | null {
  const recent = new Set(entries.filter((entry) => now - entry.playedAt <= REDISCOVER_AFTER_MS).map((entry) => entry.track.id));
  const seen = new Set<string>();
  const old: Track[] = [];
  for (const entry of entries) {
    if (now - entry.playedAt <= REDISCOVER_AFTER_MS || recent.has(entry.track.id) || seen.has(entry.track.id)) continue;
    seen.add(entry.track.id);
    old.push(entry.track);
  }
  if (old.length < MIN_FAVORITES) return null;
  return {
    id: 'rediscover',
    label: 'Feito para você',
    title: 'Redescubra',
    description: 'Músicas que você ouvia e não ouve há um tempo.',
    tracks: seededShuffle(old, `rediscover:${day}`).slice(0, MAX_MIX_TRACKS),
    colors: ['#ff9f0a', '#a35a00']
  };
}

export interface MoodChoice {
  categoryId: string;
  title: string;
  description: string;
  colors: [string, string];
}

/** The collection that suits the hour of the day. */
export function moodFor(hour: number): MoodChoice {
  if (hour >= 5 && hour < 12) return { categoryId: 'mpb', title: 'Bom dia', description: 'MPB para começar o dia com calma.', colors: ['#ffb000', '#b36b00'] };
  if (hour >= 12 && hour < 18) return { categoryId: 'pop-internacional', title: 'Para a tarde', description: 'Hits internacionais para render.', colors: ['#ff9500', '#b54a00'] };
  if (hour >= 18 && hour < 23) return { categoryId: 'top-hits', title: 'Para a noite', description: 'O que mais toca no Brasil agora.', colors: ['#bf5af2', '#4a1f78'] };
  return { categoryId: 'lofi-chill', title: 'Madrugada', description: 'Lo-fi suave para relaxar ou focar.', colors: ['#5e7ce6', '#1f2f78'] };
}

export function buildMood(pages: Record<string, TrackPage> | undefined, hour: number, day: string): PersonalMix | null {
  const mood = moodFor(hour);
  const tracks = pages?.[mood.categoryId]?.tracks ?? [];
  if (tracks.length < MIN_MOOD_TRACKS) return null;
  return {
    id: 'mood',
    label: 'Humor para você',
    title: mood.title,
    description: mood.description,
    tracks: seededShuffle(tracks, `mood:${day}:${mood.categoryId}`),
    colors: mood.colors
  };
}
