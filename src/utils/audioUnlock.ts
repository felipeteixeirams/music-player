/** A tenth of a second of silence. */
export const SILENT_CLIP = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

/** Whether the element is holding the silent clip (its events are not the user's music). */
export const isUnlockClip = (audio: HTMLAudioElement): boolean => (audio.getAttribute('src') ?? '') === SILENT_CLIP;

/**
 * iOS plays an audio element only when it was started by a tap, and only for about a second after the tap: a track
 * whose address arrives from the network after that is refused, and nothing is heard until the next tap. An element
 * that has played once because of a tap stays allowed, so the first tap plays a silent clip on it, and the real
 * track can start later without a tap. Does nothing while the element has something loaded (it is already allowed).
 */
export function unlockAudioElement(audio: HTMLAudioElement | null): void {
  if (!audio || audio.getAttribute('src')) return;
  audio.src = SILENT_CLIP;
  audio.play().catch(() => {
    // not allowed here (no tap): the next tap tries again
    if (isUnlockClip(audio)) audio.removeAttribute('src');
  });
}
