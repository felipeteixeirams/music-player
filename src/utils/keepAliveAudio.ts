import { logPlayback } from './playbackDiagnostics';

/**
 * EXPERIMENT (hypothesis, not proven): the installed app on the iPhone lets native `<audio>` keep playing in the
 * background (the radios and the podcasts do) but pauses the hidden YouTube player. While a YouTube track plays, a silent
 * native clip looping beside it might make the system treat the app as one that is playing audio and leave the player
 * alone. It is off unless the administrator turns it on (Ajustes > Administração), so it can be compared with the
 * switch on and off (roteiro T30). It adds to the background-player question in audio-sources-decisions.spec.md.
 */
export const KEEPALIVE_KEY = 'aurastream_keepalive_audio';

export function keepAliveEnabled(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    return storage?.getItem(KEEPALIVE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setKeepAliveEnabled(on: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    if (on) storage?.setItem(KEEPALIVE_KEY, '1');
    else storage?.removeItem(KEEPALIVE_KEY);
  } catch {
    // storage that refuses: the choice lasts for this session only
  }
  if (!on) keepAlive.stop();
}

/** A WAV of silence (8-bit mono, 8 kHz) as a data address: a real, endless-looping clip, not a muted element. */
export function silentWavDataUri(seconds: number): string {
  const rate = 8000;
  const samples = Math.max(1, Math.round(seconds * rate));
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => (bytes[offset + i] = char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true); // byte rate: 8 bits, mono
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(0x80, 44); // 8-bit PCM silence is the middle value
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

class KeepAliveAudio {
  private audio: HTMLAudioElement | null = null;
  private running = false;

  get isRunning(): boolean {
    return this.running;
  }

  /** Starts the silent loop (only when the experiment is on). Best made inside a tap; once it has played, later starts are allowed. */
  start(): void {
    if (this.running || !keepAliveEnabled() || typeof Audio === 'undefined') return;
    if (!this.audio) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      audio.src = silentWavDataUri(2);
      this.audio = audio;
    }
    this.running = true;
    this.audio.play().then(
      () => logPlayback('áudio mudo de manutenção: ligado'),
      (error: unknown) => {
        this.running = false;
        logPlayback(`áudio mudo de manutenção: recusado (${(error as Error)?.name ?? 'erro'}); precisa de um toque`);
      }
    );
  }

  stop(): void {
    if (!this.running || !this.audio) return;
    this.running = false;
    this.audio.pause();
    logPlayback('áudio mudo de manutenção: desligado');
  }
}

export const keepAlive = new KeepAliveAudio();
