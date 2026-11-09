// Gera o catálogo de coletâneas históricas (public/historic/) a partir do Discogs (listas de faixas e artistas) e do
// Deezer (identificador de cada faixa, para tocar e para a prévia). Roda à mão, de vez em quando, e a saída é
// revisada e commitada: o app não consulta o Discogs. Não é executado no build nem no servidor.
//
//   npx tsx scripts/build-historic-compilations.mjs         # tudo (pode levar bem mais de uma hora sem token)
//   DISCOGS_TOKEN=... npx tsx scripts/build-historic-compilations.mjs   # com token o limite do Discogs é 60/min
//   LIMIT=20 npx tsx scripts/build-historic-compilations.mjs    # só as 20 primeiras (para conferir)
//
// Respostas brutas ficam em scripts/.historic-cache/ (ignorado pelo git), e uma execução retoma de onde parou.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseTitle, norm } from '../src/utils/historicNames.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, 'scripts', '.historic-cache');
const OUT = join(ROOT, 'public', 'historic');
const UA = 'AuraStream/1.0 (catalogo de colecoes historicas; repositorio music-player)';
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const DISCOGS_GAP_MS = DISCOGS_TOKEN ? 1100 : 2600;
const LABEL = 'Som Livre';
const LIMIT = Number(process.env.LIMIT) || Infinity;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastDiscogs = 0;

/** A JSON response, with the Discogs rate limit respected and a short retry on 429. */
async function getJson(url, { discogs = false, attempt = 1 } = {}) {
  if (discogs) {
    const wait = lastDiscogs + DISCOGS_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastDiscogs = Date.now();
  }
  const headers = { 'User-Agent': UA };
  if (discogs && DISCOGS_TOKEN) headers.Authorization = `Discogs token=${DISCOGS_TOKEN}`;
  const response = await fetch(url, { headers });
  if ((response.status === 429 || response.status === 503) && attempt <= 3) {
    await sleep(response.status === 429 ? 65_000 : 15_000);
    return getJson(url, { discogs, attempt: attempt + 1 });
  }
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

/** Discogs lists some artists with a disambiguation number ("Klaus Spencer (3)"): the number is not part of the name. */
const cleanArtist = (name) => String(name ?? '').replace(/\s*\(\d+\)$/, '').trim();

/**
 * Every compilation of the label: releases with a master and releases without one (a CD that has no master, such as
 * Power Ballads, is only a "release"). The search pages overlap, and a CD can appear twice, so each is kept once.
 */
async function listCompilations() {
  const found = new Map();
  const collect = async (type, year) => {
    for (let page = 1; page <= 100; page += 1) {
      const yearPart = year ? `&year=${year}` : '';
      const url = `https://api.discogs.com/database/search?label=${encodeURIComponent(LABEL)}&artist=Various&type=${type}${yearPart}&per_page=100&page=${page}`;
      const data = await getJson(url, { discogs: true });
      for (const r of data.results) {
        // Only compilations (the artist is "Various"); everything else in the label is not a compilation
        if (!/^Various\s*-\s/i.test(r.title)) continue;
        found.set(`${type}-${r.id}`, { kind: type, id: r.id, title: r.title, year: r.year ?? null, catno: r.catno ?? null });
      }
      if (page >= data.pagination.pages) break;
    }
  };
  // Deep pages of one long search are not complete (a CD found by its name was missing from them), so the label is
  // also split by year: each year is a short search that the API answers in full.
  for (const type of ['master', 'release']) {
    await collect(type, null);
    for (let year = 1930; year <= new Date().getFullYear(); year += 1) await collect(type, year);
  }
  // The same CD can come as a master and as its own release: keep one (the master). A label number identifies a CD;
  // without one, the title and year do.
  const seen = new Set();
  const unique = [];
  for (const item of [...found.values()].sort((a, b) => (a.kind === 'master' ? -1 : 1) - (b.kind === 'master' ? -1 : 1))) {
    const key = item.catno ? `cat:${norm(item.catno)}` : `t:${norm(item.title)}|${item.year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

/** The edition to use: a master's main release, or the release itself (its tracklist names the artist of each track). */
async function fetchEdition(item) {
  const file = join(CACHE, `${item.kind}-${item.id}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  let release;
  let year = item.year;
  if (item.kind === 'master') {
    const detail = await getJson(`https://api.discogs.com/masters/${item.id}`, { discogs: true });
    release = detail.main_release ? await getJson(`https://api.discogs.com/releases/${detail.main_release}`, { discogs: true }) : null;
    year = detail.year ?? year;
  } else {
    release = await getJson(`https://api.discogs.com/releases/${item.id}`, { discogs: true });
  }
  const data = { id: item.id, title: item.title, year, release };
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return data;
}

/** The Deezer track that is this track: same title, same artist. Anything else is left unmatched on purpose. */
async function deezerTrack(title, artist) {
  if (!title || !artist) return null;
  // A hash for the file name: long titles would not fit in a file name
  const key = createHash('sha1').update(norm(`${title} ${artist}`)).digest('hex');
  const file = join(CACHE, 'deezer', `${key}.json`);
  let found;
  if (existsSync(file)) {
    found = JSON.parse(readFileSync(file, 'utf8'));
  } else {
    await sleep(120);
    // Plain text: the Deezer search does not understand field syntax (track:"..." returns nothing). The filter below
    // keeps only the candidates whose title and artist really are these.
    const q = encodeURIComponent(`${title} ${artist}`);
    const data = await getJson(`https://api.deezer.com/search/track?q=${q}&limit=10`);
    found = data.data ?? [];
    mkdirSync(join(CACHE, 'deezer'), { recursive: true });
    writeFileSync(file, JSON.stringify(found));
  }
  const wantedTitle = norm(title);
  const wantedArtist = norm(artist);
  const hit = found.find((t) => norm(t.title) === wantedTitle && norm(t.artist?.name) === wantedArtist);
  return hit ? hit.id : null;
}

/** Comparable catalog number: "3106-2" and "3106 2" are the same CD. */
const catnoKey = (text) => String(text ?? '').replace(/[\s-]/g, '').toUpperCase();

/**
 * The MusicBrainz release of a CD, found by its catalog number (and the label). The Cover Art Archive has the artwork of
 * that release. Only an exact catalog number counts: a title match could be another edition. Cached.
 */
async function coverRelease(catno) {
  const file = join(CACHE, 'mb', `${createHash('sha1').update(catnoKey(catno)).digest('hex')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).mbid;
  await sleep(1100); // MusicBrainz asks for one request a second
  const q = encodeURIComponent(`catno:"${catno}"`);
  const data = await getJson(`https://musicbrainz.org/ws/2/release/?query=${q}&fmt=json&limit=10`);
  const hit = (data.releases ?? []).find((r) => (r['label-info'] ?? []).some((l) => catnoKey(l['catalog-number']) === catnoKey(catno)));
  let mbid = null;
  if (hit && (await artworkExists(hit.id))) mbid = hit.id;
  mkdirSync(join(CACHE, 'mb'), { recursive: true });
  writeFileSync(file, JSON.stringify({ catno, mbid }));
  return mbid;
}

/** The Cover Art Archive answers with the front image of the release (it redirects to the file). */
async function artworkExists(mbid) {
  const response = await fetch(`https://coverartarchive.org/release/${mbid}/front-250`, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow' });
  return response.ok;
}

/**
 * COVERS_ONLY=1: adds the artwork to a catalog that is already built (no Discogs or Deezer calls): reads public/historic,
 * finds each CD's MusicBrainz release by catalog number, and rewrites the index and the CD files with `mbid`.
 */
async function addCovers() {
  const indexFile = join(OUT, 'index.json');
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  let found = 0;
  for (const [i, entry] of index.compilations.entries()) {
    const recordFile = join(OUT, 't', `${entry.id}.json`);
    const record = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')) : null;
    const catno = entry.catno ?? record?.catno;
    let mbid = null;
    if (catno) {
      try {
        mbid = await coverRelease(catno);
      } catch (error) {
        console.warn(`[${i + 1}/${index.compilations.length}] capa: ${entry.title} (${catno}): ${error.message}`);
      }
    }
    if (mbid) found += 1;
    entry.mbid = mbid;
    if (record) writeFileSync(recordFile, JSON.stringify({ ...record, mbid }));
    if ((i + 1) % 100 === 0) console.log(`[${i + 1}/${index.compilations.length}] capas encontradas até agora: ${found}`);
  }
  writeFileSync(indexFile, JSON.stringify({ ...index, coversAt: new Date().toISOString().slice(0, 10) }));
  console.log(`capas: ${found} de ${index.compilations.length} CDs (Cover Art Archive, pelo número de catálogo)`);
}

async function main() {
  if (process.env.COVERS_ONLY === '1') return addCovers();
  const masters = (await listCompilations()).slice(0, LIMIT);
  console.log(`${masters.length} compilações da ${LABEL} no Discogs (masters e releases, sem repetição)`);
  mkdirSync(join(OUT, 't'), { recursive: true });
  const index = [];
  for (const [i, master] of masters.entries()) {
    // A release the Discogs no longer serves (404) or that fails once is skipped and named in the log, not fatal
    let edition;
    try {
      edition = await fetchEdition(master);
    } catch (error) {
      console.warn(`[${i + 1}/${masters.length}] pulada (${master.id} ${master.title}): ${error.message}`);
      continue;
    }
    const release = edition.release;
    const lines = (release?.tracklist ?? [])
      .filter((t) => t.type_ === 'track' && t.title)
      .map((t) => ({ position: t.position, title: t.title, artist: cleanArtist(t.artists?.[0]?.name) || null, duration: t.duration || null }));
    // Four Deezer lookups at a time (the Deezer allows far more); the Discogs pace above is the real limit
    const tracks = [];
    for (let k = 0; k < lines.length; k += 4) {
      const group = lines.slice(k, k + 4);
      const ids = await Promise.all(group.map((line) => (line.artist ? deezerTrack(line.title, line.artist) : null)));
      group.forEach((line, n) => tracks.push({ ...line, deezerId: ids[n] }));
    }
    const label = release?.labels?.[0];
    // Masters and releases have separate number spaces: the id says which one it is (m123, r456)
    const record = {
      id: `${master.kind === 'master' ? 'm' : 'r'}${master.id}`,
      title: master.title.replace(/^various\s*-\s*/i, ''),
      base: baseTitle(master.title),
      year: Number(release?.year || edition.year) || null,
      label: label?.name ?? LABEL,
      catno: label?.catno ?? null,
      country: release?.country ?? null,
      tracks,
      matched: tracks.filter((t) => t.deezerId).length
    };
    writeFileSync(join(OUT, 't', `${record.id}.json`), JSON.stringify(record));
    index.push({ id: record.id, title: record.title, base: record.base, year: record.year, catno: record.catno, tracks: tracks.length, matched: record.matched });
    console.log(`[${i + 1}/${masters.length}] ${record.title} (${record.year ?? '?'}): ${record.matched}/${tracks.length} faixas no Deezer`);
  }
  index.sort((a, b) => a.base.localeCompare(b.base) || (a.year ?? 0) - (b.year ?? 0));
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), source: 'Discogs (listas) e Deezer (identificadores)', compilations: index }));
  console.log(`índice: ${index.length} compilações`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
