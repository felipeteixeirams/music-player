import type { Track } from '../types/music';
import type { PlayEntry } from './playHistory';

export interface TrackPlayStat {
  track: Track;
  count: number;
  lastPlayedAt: number;
}

export interface ArtistPlayStat {
  artist: string;
  count: number;
  trackCount: number;
  coverUrl?: string;
}

export interface TimelineGroup {
  period: string;
  entries: PlayEntry[];
}

export interface PlayStats {
  totalPlays: number;
  uniqueTracksCount: number;
  uniqueArtistsCount: number;
  totalMinutesListened: number;
  topTracks: TrackPlayStat[];
  topArtists: ArtistPlayStat[];
  timeline: TimelineGroup[];
  favoriteArtist?: ArtistPlayStat;
}

/**
 * Categorizes a timestamp into a friendly human-readable time period group.
 */
export function getTimelinePeriod(timestamp: number, now = Date.now()): string {
  const nowDate = new Date(now);
  const playDate = new Date(timestamp);

  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) {
    return 'Hoje';
  }
  if (timestamp >= startOfYesterday) {
    return 'Ontem';
  }
  if (timestamp >= startOfWeek) {
    return 'Esta semana';
  }
  return 'Mais antigas';
}

/**
 * Formats relative timestamp for detailed history rows (e.g. "Há 12 min", "Às 15:30", "12 de out").
 */
export function formatPlayTime(timestamp: number, now = Date.now()): string {
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

  if (diffMinutes < 1) return 'Agora mesmo';
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  if (diffHours < 24) {
    const d = new Date(timestamp);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `Às ${hours}:${mins}`;
  }

  const d = new Date(timestamp);
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/**
 * Aggregates play history entries into detailed listening statistics.
 */
export function computePlayStats(entries: PlayEntry[], now = Date.now()): PlayStats {
  if (!entries || entries.length === 0) {
    return {
      totalPlays: 0,
      uniqueTracksCount: 0,
      uniqueArtistsCount: 0,
      totalMinutesListened: 0,
      topTracks: [],
      topArtists: [],
      timeline: []
    };
  }

  const trackMap = new Map<string, { track: Track; count: number; lastPlayedAt: number }>();
  const artistMap = new Map<string, { artist: string; count: number; tracks: Set<string>; coverUrl?: string }>();
  let totalDurationSec = 0;

  for (const entry of entries) {
    if (!entry.track || !entry.track.id) continue;
    const track = entry.track;

    // Duration accumulation (fallback to 180s if track duration is 0)
    totalDurationSec += track.duration > 0 ? track.duration : 180;

    // Track play counter
    const existingTrack = trackMap.get(track.id);
    if (existingTrack) {
      existingTrack.count += 1;
      if (entry.playedAt > existingTrack.lastPlayedAt) {
        existingTrack.lastPlayedAt = entry.playedAt;
      }
    } else {
      trackMap.set(track.id, {
        track,
        count: 1,
        lastPlayedAt: entry.playedAt
      });
    }

    // Artist play counter
    const artistKey = track.artist.trim().toLowerCase();
    const existingArtist = artistMap.get(artistKey);
    if (existingArtist) {
      existingArtist.count += 1;
      existingArtist.tracks.add(track.id);
      if (!existingArtist.coverUrl && track.coverUrl) {
        existingArtist.coverUrl = track.coverUrl;
      }
    } else {
      artistMap.set(artistKey, {
        artist: track.artist,
        count: 1,
        tracks: new Set([track.id]),
        coverUrl: track.coverUrl
      });
    }
  }

  // Top Tracks: sorted by plays descending, then by most recently played
  const topTracks: TrackPlayStat[] = Array.from(trackMap.values())
    .sort((a, b) => b.count - a.count || b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, 50);

  // Top Artists: sorted by total plays descending
  const topArtists: ArtistPlayStat[] = Array.from(artistMap.values())
    .map((item) => ({
      artist: item.artist,
      count: item.count,
      trackCount: item.tracks.size,
      coverUrl: item.coverUrl
    }))
    .sort((a, b) => b.count - a.count || b.trackCount - a.trackCount)
    .slice(0, 20);

  // Grouped Timeline: chronological buckets ("Hoje", "Ontem", "Esta semana", "Mais antigas")
  const periodMap = new Map<string, PlayEntry[]>();
  for (const entry of entries) {
    const period = getTimelinePeriod(entry.playedAt, now);
    const list = periodMap.get(period);
    if (list) {
      list.push(entry);
    } else {
      periodMap.set(period, [entry]);
    }
  }

  const periodOrder = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'];
  const timeline: TimelineGroup[] = [];
  for (const period of periodOrder) {
    const list = periodMap.get(period);
    if (list && list.length > 0) {
      timeline.push({ period, entries: list });
    }
  }

  return {
    totalPlays: entries.length,
    uniqueTracksCount: trackMap.size,
    uniqueArtistsCount: artistMap.size,
    totalMinutesListened: Math.round(totalDurationSec / 60),
    topTracks,
    topArtists,
    timeline,
    favoriteArtist: topArtists[0]
  };
}
