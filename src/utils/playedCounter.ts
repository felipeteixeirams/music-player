import type { Track } from '../types/music';
import { isPodcastTrack } from './podcastTrack';

/** A play counts after this much listening, or half the track when it is shorter than twice this. */
export const PLAY_THRESHOLD_SECONDS = 25;

/** Between two clock ticks, more than this is a seek and does not count as listening. */
const MAX_TICK_GAP_SECONDS = 2;

export const playThreshold = (durationSeconds: number): number =>
  Math.min(PLAY_THRESHOLD_SECONDS, Math.max(1, durationSeconds * 0.5));

/**
 * Decides when a track has been "played": once, after enough real listening. Fed by the playback clock, which only
 * ticks while audio plays, so pauses cost nothing; jumping ahead does not count, and starting the track over (repeat,
 * or going back to its start) is a new play.
 */
export class PlayedCounter {
  private trackId: string | null = null;
  private last = 0;
  private listened = 0;
  private counted = false;

  constructor(private readonly onPlayed: (track: Track) => void) {}

  tick(track: Track | null, seconds: number): void {
    // A podcast episode is not a play of music: it stays out of the history and of the mixes made from it
    if (!track || isPodcastTrack(track)) return;
    if (track.id !== this.trackId) {
      this.trackId = track.id;
      this.listened = 0;
      this.counted = false;
      this.last = seconds;
      return;
    }

    const delta = seconds - this.last;
    this.last = seconds;
    if (delta > 0 && delta <= MAX_TICK_GAP_SECONDS) this.listened += delta;
    // Back near the start after a full play: it started over
    else if (this.counted && delta < -MAX_TICK_GAP_SECONDS && seconds <= MAX_TICK_GAP_SECONDS) {
      this.listened = 0;
      this.counted = false;
    }

    if (!this.counted && this.listened >= playThreshold(track.duration)) {
      this.counted = true;
      this.onPlayed(track);
    }
  }

  /** The queue moved on or stopped. */
  reset(): void {
    this.trackId = null;
    this.listened = 0;
    this.counted = false;
  }
}
