/** A tenth of a second of silence. */
export const SILENT_CLIP = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

let cachedSilentUrl: string | null = null;

/** Generates a 3-second silent WAV Blob URL in the browser, or falls back to SILENT_CLIP. */
export function generateSilentWavBlobUrl(durationSeconds = 3): string {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return SILENT_CLIP;
  }
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * durationSeconds;
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    // RIFF chunk
    view.setUint8(0, 0x52); // 'R'
    view.setUint8(1, 0x49); // 'I'
    view.setUint8(2, 0x46); // 'F'
    view.setUint8(3, 0x46); // 'F'
    view.setUint32(4, 36 + numSamples, true);
    // WAVE chunk
    view.setUint8(8, 0x57);  // 'W'
    view.setUint8(9, 0x41);  // 'A'
    view.setUint8(10, 0x56); // 'V'
    view.setUint8(11, 0x45); // 'E'
    // fmt subchunk
    view.setUint8(12, 0x66); // 'f'
    view.setUint8(13, 0x6d); // 'm'
    view.setUint8(14, 0x74); // 't'
    view.setUint8(15, 0x20); // ' '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true); // 8-bit
    // data subchunk
    view.setUint8(36, 0x64); // 'd'
    view.setUint8(37, 0x61); // 'a'
    view.setUint8(38, 0x74); // 't'
    view.setUint8(39, 0x61); // 'a'
    view.setUint32(40, numSamples, true);
    // Fill with silence (8-bit PCM center is 128)
    new Uint8Array(buffer, 44).fill(128);

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch {
    return SILENT_CLIP;
  }
}

/** Returns the active silent audio clip URL (memoized). */
export function getSilentAudioUrl(): string {
  if (cachedSilentUrl) return cachedSilentUrl;
  cachedSilentUrl = generateSilentWavBlobUrl(3);
  return cachedSilentUrl;
}

/** Whether the given source string is one of our silent clips. */
export function isSilentAudioSource(src: string | null | undefined): boolean {
  if (!src) return false;
  return src === SILENT_CLIP || src === cachedSilentUrl;
}

/** Whether the element is holding the silent clip (its events are not the user's music). */
export const isUnlockClip = (audio: HTMLAudioElement | null | undefined): boolean => {
  if (!audio) return false;
  const src = audio.getAttribute('src') ?? (audio as unknown as { src?: string }).src ?? '';
  return isSilentAudioSource(src);
};

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

/**
 * Starts a silent audio keep-alive loop on a dedicated audio element.
 * When the app is in PWA standalone or mobile browser and playing via YouTube iframe, iOS WebKit
 * suspends background execution unless an HTML5 audio element is actively playing in the document.
 * This silent loop keeps WebKit's AVAudioSession in category Playback without audible noise.
 */
export function startAudioKeepAlive(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  const url = getSilentAudioUrl();
  if (audio.getAttribute('src') !== url && (audio as unknown as { src?: string }).src !== url) {
    audio.src = url;
  }
  audio.loop = true;
  audio.volume = 0.001;
  audio.play().catch(() => {});
}

/** Stops the silent audio keep-alive loop on the given audio element. */
export function stopAudioKeepAlive(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.pause();
  audio.loop = false;
  if (isUnlockClip(audio)) {
    audio.removeAttribute('src');
    try {
      audio.src = '';
    } catch {}
  }
}
