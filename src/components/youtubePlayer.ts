import { lazy } from 'react';
import { canPlay } from 'react-player/patterns';
import { createReactPlayer } from 'react-player/ReactPlayer';
import type { PlayerEntry } from 'react-player/players';

/**
 * ReactPlayer restricted to YouTube. The stock `react-player` entry registers every provider and the build
 * ships a chunk for each (hls.js, dash.js, Mux, Vimeo...), none of which the app plays.
 *
 * `createReactPlayer`, `canPlay` and the `PlayerEntry` type are reached through react-player's wildcard
 * exports and are not documented API: recheck this file when upgrading react-player. The type-only import
 * of `react-player/players` is erased at build time; importing its value would bring every chunk back.
 */
const youtube: PlayerEntry = {
  key: 'youtube',
  name: 'YouTube',
  canPlay: canPlay.youtube,
  // react-player types its entries loosely; the element wrapper is the one react-player itself registers
  player: lazy(() => import('youtube-video-element/react')) as unknown as PlayerEntry['player']
};

export const YouTubePlayer = createReactPlayer([youtube], youtube);
