export interface LrcLine {
  time: number; // in seconds
  text: string;
}

export async function fetchSyncedLyrics(artist: string, track: string): Promise<{ syncedLines: LrcLine[]; plainLyrics: string[] }> {
  if (!artist || !track) return { syncedLines: [], plainLyrics: [] };

  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(`${track} ${artist}`)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { syncedLines: [], plainLyrics: [] };

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      // Find best match with synced lyrics
      const match = data.find((item: any) => item && item.syncedLyrics) || data[0];
      if (match) {
        if (match.syncedLyrics) {
          const parsed = parseLrc(match.syncedLyrics);
          if (parsed.length > 0) {
            return {
              syncedLines: parsed,
              plainLyrics: parsed.map((l) => l.text)
            };
          }
        }
        if (match.plainLyrics) {
          const plain = match.plainLyrics.split('\n').filter((l: string) => l.trim().length > 0);
          return { syncedLines: [], plainLyrics: plain };
        }
      }
    }
  } catch (err) {
    console.warn('LRCLIB fetch notice:', err);
  }

  return { syncedLines: [], plainLyrics: [] };
}

function parseLrc(lrcText: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/g;
  let match;

  while ((match = regex.exec(lrcText)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const millis = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
    const totalSeconds = minutes * 60 + seconds + millis / 1000;
    const text = match[4] ? match[4].trim() : '';
    if (text) {
      lines.push({ time: totalSeconds, text });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}
