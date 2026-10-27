/**
 * Live radio stations by style, from the community directory radio-browser.info (free, open source, no key).
 * Its rules, from api.radio-browser.info: never rely on one server (go through the mirrors, the next one when a
 * request fails), send a descriptive User-Agent, and report a click when someone plays a station. The service
 * says it may be down, so the screen keeps the curated list (`src/data/liveRadios.ts`) and shows these as extra.
 */

export interface LiveStyle {
  id: string;
  name: string;
  /** The directory tag searched for. */
  tag: string;
  /** Two-letter country the stations must be from; empty for the whole world (styles Brazil has few of). */
  countrycode: string;
}

export const LIVE_STYLES: LiveStyle[] = [
  { id: 'rock', name: 'Rock', tag: 'rock', countrycode: 'BR' },
  { id: 'pop', name: 'Pop', tag: 'pop', countrycode: 'BR' },
  { id: 'sertanejo', name: 'Sertanejo', tag: 'sertanejo', countrycode: 'BR' },
  { id: 'mpb', name: 'MPB', tag: 'mpb', countrycode: 'BR' },
  { id: 'samba', name: 'Samba e pagode', tag: 'samba', countrycode: 'BR' },
  { id: 'forro', name: 'Forró', tag: 'forro', countrycode: 'BR' },
  { id: 'funk', name: 'Funk', tag: 'funk', countrycode: 'BR' },
  { id: 'hiphop', name: 'Hip hop', tag: 'hip hop', countrycode: '' },
  { id: 'gospel', name: 'Gospel', tag: 'gospel', countrycode: 'BR' },
  { id: 'reggae', name: 'Reggae', tag: 'reggae', countrycode: 'BR' },
  { id: 'jazz', name: 'Jazz', tag: 'jazz', countrycode: '' },
  { id: 'classica', name: 'Clássica', tag: 'classical', countrycode: '' },
  { id: 'eletronica', name: 'Eletrônica', tag: 'electronic', countrycode: '' },
  { id: 'lofi', name: 'Lo-fi e chill', tag: 'lofi', countrycode: '' }
];

export const findLiveStyle = (id: unknown): LiveStyle | undefined =>
  typeof id === 'string' ? LIVE_STYLES.find((style) => style.id === id) : undefined;

export interface LiveStationResult {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
}

/** Servers of the directory, tried in order: the service asks apps to fall over to the next one when a request fails. */
const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://all.api.radio-browser.info'
];

const USER_AGENT = 'music-player/1.0 (personal app; contact via GitHub felipeteixeirams/music-player)';
const REQUEST_TIMEOUT_MS = 6000;
const FETCH_LIMIT = 80;
export const MAX_STATIONS = 12;
/** Formats every phone plays from an `<audio>` tag. */
const PLAYABLE_CODECS = new Set(['MP3', 'AAC', 'AAC+']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FetchImpl = typeof fetch;

interface DirectoryStation {
  stationuuid?: unknown;
  name?: unknown;
  url_resolved?: unknown;
  codec?: unknown;
  lastcheckok?: unknown;
  state?: unknown;
  country?: unknown;
}

const clean = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** The directory's answer reduced to stations a phone can play now: checked OK, HTTPS, a known format, no repeats. */
export function toLiveStations(payload: unknown): LiveStationResult[] {
  if (!Array.isArray(payload)) return [];
  const seen = new Set<string>();
  const stations: LiveStationResult[] = [];
  for (const item of payload as DirectoryStation[]) {
    const uuid = typeof item?.stationuuid === 'string' ? item.stationuuid : '';
    const name = clean(item?.name, 60);
    const url = typeof item?.url_resolved === 'string' ? item.url_resolved.trim() : '';
    const codec = typeof item?.codec === 'string' ? item.codec.toUpperCase() : '';
    if (!UUID.test(uuid) || !name || item?.lastcheckok !== 1 || !PLAYABLE_CODECS.has(codec)) continue;
    if (!url.startsWith('https://') || url.length > 500) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    stations.push({ id: `rb-${uuid}`, name, location: clean(item?.state, 40) || clean(item?.country, 40) || 'Ao vivo', streamUrl: url });
    if (stations.length >= MAX_STATIONS) break;
  }
  return stations;
}

async function fromMirrors(path: string, fetchImpl: FetchImpl): Promise<unknown> {
  let lastError: unknown;
  for (const mirror of MIRRORS) {
    try {
      const response = await fetchImpl(`${mirror}${path}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('radio-browser indisponível');
}

/** The most listened-to working stations of a style. Throws when no server of the directory answers. */
export async function fetchLiveStations(style: LiveStyle, fetchImpl: FetchImpl = fetch): Promise<LiveStationResult[]> {
  const params = new URLSearchParams({
    tag: style.tag,
    tagExact: 'true',
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: String(FETCH_LIMIT)
  });
  if (style.countrycode) params.set('countrycode', style.countrycode);
  return toLiveStations(await fromMirrors(`/json/stations/search?${params}`, fetchImpl));
}

export const isStationUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** Tells the directory somebody played the station (it asks for this: it is how stations become "popular"). */
export async function reportStationClick(uuid: string, fetchImpl: FetchImpl = fetch): Promise<void> {
  await fromMirrors(`/json/url/${uuid}`, fetchImpl);
}
