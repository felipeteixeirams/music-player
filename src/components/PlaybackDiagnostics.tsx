import React, { useState, useSyncExternalStore } from 'react';
import { Activity, Copy } from 'lucide-react';
import { sessionId } from '../utils/trace';
import { clearPlaybackLog, describeEnvironment, formatPlaybackLog, getPlaybackLog, subscribePlaybackLog } from '../utils/playbackDiagnostics';

/** The running build and whether this is the installed app or a browser tab: the first thing a report needs. */
function currentEnvironment(): string {
  const standalone =
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return describeEnvironment({ version: __APP_VERSION__, standalone: Boolean(standalone), userAgent: navigator.userAgent, session: sessionId });
}

/** What happened the last times a track was started, in the user's own words: to report a track that does not play. */
export const PlaybackDiagnostics: React.FC = () => {
  const entries = useSyncExternalStore(subscribePlaybackLog, getPlaybackLog);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${currentEnvironment()}\n${formatPlaybackLog(entries)}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard refused: the text is on the screen to be read
    }
  };

  return (
    <div className="px-4 py-3 text-[15px] text-label">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 text-left" aria-expanded={open}>
        <Activity className="h-4 w-4 text-accent" aria-hidden="true" />
        <span>Diagnóstico de reprodução</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p data-testid="playback-environment" className="text-[11px] font-semibold leading-4 text-label">
            {currentEnvironment()}
          </p>
          <pre
            data-testid="playback-log"
            className="max-h-44 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-4 text-label-secondary"
          >
            {entries.length > 0 ? formatPlaybackLog(entries) : 'Nada ainda. Toque uma faixa e volte aqui.'}
          </pre>
          <div className="flex gap-2">
            <button onClick={() => void copy()} className="flex items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-[13px]">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button onClick={clearPlaybackLog} className="rounded-full bg-fill px-3 py-1 text-[13px]">
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
