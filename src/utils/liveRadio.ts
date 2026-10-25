import type { LiveStation, Track } from '../types/music';

/** A live station as a `Track`, so the player, the queue and the media session treat it like anything playable. */
export function liveStationToTrack(station: LiveStation): Track {
  return {
    id: `live-${station.id}`,
    title: station.name,
    artist: station.location,
    album: 'Rádio ao vivo',
    duration: 0,
    coverUrl: '/icon.svg',
    style: 'Ao vivo',
    categoryId: 'live',
    sources: { localUrl: station.streamUrl, isLive: true }
  };
}

/** True for an ongoing broadcast: it has no length, nothing to seek and nothing before or after. */
export function isLiveTrack(track: Track | null | undefined): boolean {
  return track?.sources.isLive === true;
}
