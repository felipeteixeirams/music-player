/**
 * Piped API & Audio Stream Logger Utility
 * Logs extracted audio stream URLs, bitrates, instances, and YouTube stream targets
 * to the browser console for inspection and verification.
 */

export interface PipedLogPayload {
  context: 'search' | 'stream_extraction' | 'playback_start';
  trackTitle?: string;
  artist?: string;
  youtubeId: string;
  audioUrl?: string | null;
  quality?: string;
  bitrate?: number;
  instanceUsed?: string;
  cached?: boolean;
  sourceType: 'Piped Direct Audio Stream' | 'YouTube Headless Stream' | 'Local Audio';
  details?: Record<string, any>;
}

export function logPipedAudioExtraction(payload: PipedLogPayload): void {
  const timestamp = new Date().toLocaleTimeString();
  const title = payload.trackTitle ? `"${payload.trackTitle}" por ${payload.artist || 'Desconhecido'}` : payload.youtubeId;

  // Formatted styled console output for DevTools inspection
  console.groupCollapsed(
    `%c[Piped API]%c 🎵 Extração de Áudio: ${title} (%c${timestamp}%c)`,
    'background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    'color: #e2e8f0; font-weight: bold;',
    'color: #38bdf8;',
    'color: #e2e8f0;'
  );

  console.log('%cTítulo / Artista:%c', 'color: #94a3b8; font-weight: bold;', 'color: #ffffff;', title);
  console.log('%cYouTube Video ID:%c', 'color: #94a3b8; font-weight: bold;', 'color: #a78bfa; font-family: monospace;', payload.youtubeId);
  console.log('%cMotor / Instância:%c', 'color: #94a3b8; font-weight: bold;', 'color: #34d399;', payload.instanceUsed || 'Piped Local Proxy');
  console.log('%cTipo de Fluxo:%c', 'color: #94a3b8; font-weight: bold;', 'color: #38bdf8;', payload.sourceType);
  if (payload.quality) {
    console.log('%cQualidade / Bitrate:%c', 'color: #94a3b8; font-weight: bold;', 'color: #fbbf24;', payload.quality);
  }

  if (payload.audioUrl) {
    console.log(
      '%c🔗 URL EXATA DO ÁUDIO EXTRAÍDO:%c\n' + payload.audioUrl,
      'color: #10b981; font-weight: bold; text-decoration: underline;',
      'color: #6ee7b7; font-family: monospace; word-break: break-all;'
    );
  } else {
    console.log(
      '%cℹ️ URL Direta Opus/M4A não disponibilizada; executando fluxo original via YouTube Engine:%c\nhttps://www.youtube.com/watch?v=' + payload.youtubeId,
      'color: #f59e0b; font-weight: bold;',
      'color: #fbbf24; font-family: monospace;'
    );
  }

  if (payload.details) {
    console.log('%cMetadados Adicionais:%c', 'color: #94a3b8; font-weight: bold;', '', payload.details);
  }

  console.groupEnd();
}
