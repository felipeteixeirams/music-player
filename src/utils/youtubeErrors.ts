/**
 * What the YouTube player's error codes mean and what the app does about each one. The codes come from the IFrame
 * API (`onError`), plus -1 that the app itself raises when the player script cannot be loaded.
 * Denouncing a video takes it out of the shared cache (and out of everyone's next play), so it is done only when the
 * video itself is the problem: a blocked script or a hiccup of the player must never cost a healthy video its place.
 */
export type YouTubeFailureKind = 'embed-blocked' | 'not-found' | 'invalid' | 'player' | 'not-loaded' | 'unknown';

export interface YouTubeFailure {
  kind: YouTubeFailureKind;
  /** In words, for the diagnostics and the report. */
  description: string;
  /** The video is the problem: take it out of the shared cache. */
  denounce: boolean;
  /** Try the same video once more before giving up on it (a hiccup of the player). */
  retrySame: boolean;
  /** Another version of the track may play (false when the player itself is missing: every version would fail the same). */
  tryOtherVersions: boolean;
}

export function classifyYouTubeError(code: number | undefined): YouTubeFailure {
  switch (code) {
    case 101:
    case 150:
      return { kind: 'embed-blocked', description: 'o dono do vídeo não permite incorporá-lo em outro site', denounce: true, retrySame: false, tryOtherVersions: true };
    case 100:
      return { kind: 'not-found', description: 'vídeo removido, privado ou não encontrado', denounce: true, retrySame: false, tryOtherVersions: true };
    case 2:
      return { kind: 'invalid', description: 'pedido inválido (código de vídeo errado)', denounce: true, retrySame: false, tryOtherVersions: true };
    case 5:
      return { kind: 'player', description: 'erro do player HTML5 (costuma ser passageiro)', denounce: false, retrySame: true, tryOtherVersions: true };
    case -1:
      return { kind: 'not-loaded', description: 'o player do YouTube não carregou (script bloqueado ou sem rede)', denounce: false, retrySame: false, tryOtherVersions: false };
    default:
      return { kind: 'unknown', description: `erro desconhecido do player${code === undefined ? '' : ` (${code})`}`, denounce: false, retrySame: false, tryOtherVersions: true };
  }
}

export const describeYouTubeError = (code: number): string => classifyYouTubeError(code).description;
