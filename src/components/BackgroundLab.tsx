import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { sessionId } from '../utils/trace';
import { describeEnvironment } from '../utils/playbackDiagnostics';
import { generateSilentWavBlobUrl } from '../utils/audioUnlock';
import { loadApi, type YouTubeApi } from '../utils/youtubeEngine';
import { describeYouTubeError } from '../utils/youtubeErrors';
import {
  DEFAULT_LAB_OPTIONS,
  DEFAULT_RADIO_URL,
  DEFAULT_VIDEO_ID,
  LAB_CASES,
  LAB_EXITS,
  describeAdvance,
  SILENT_SECONDS,
  formatLabClock,
  formatLabReport,
  parseStreamUrl,
  parseVideoId,
  shouldNudge,
  type LabCase,
  type LabExit,
  type LabLine,
  type LabOptions
} from '../utils/backgroundLab';

const YT_STATES: Record<number, string> = { [-1]: 'não iniciado', 0: 'terminou', 1: 'tocando', 2: 'pausado', 3: 'carregando', 5: 'pronto' };

function currentEnvironment(): string {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return describeEnvironment({ version: __APP_VERSION__, standalone: Boolean(standalone), userAgent: navigator.userAgent, session: sessionId });
}

type AudioSessionLike = { type?: string; state?: string };
const audioSession = (): AudioSessionLike | undefined => (navigator as unknown as { audioSession?: AudioSessionLike }).audioSession;

interface Running {
  labCase: LabCase;
  startedAt: number;
  audio: HTMLAudioElement | null;
  iframe: HTMLIFrameElement | null;
  player: YouTubeApi | null;
  /** Blob address of the silent file, released when the case stops. */
  silentUrl: string;
  /** The video reached the playing state at least once (no more touches needed to start it). */
  videoStarted: boolean;
  lastNudgeAt: number;
}

/**
 * Administrator-only lab: plays one isolated case, and reports what the system did to it when the app left the screen.
 * Open it from Settings > Administration; closing it stops everything it started.
 */
export const BackgroundLab: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isPlaying, togglePlayPause } = useAudio();
  const [options, setOptions] = useState<LabOptions>(DEFAULT_LAB_OPTIONS);
  const [radioText, setRadioText] = useState(DEFAULT_RADIO_URL);
  const [videoText, setVideoText] = useState(DEFAULT_VIDEO_ID);
  const [selected, setSelected] = useState<LabCase>(LAB_CASES[0]);
  const [lines, setLines] = useState<LabLine[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState('');
  const [lateRadio, setLateRadio] = useState(false);
  const [exitMode, setExitMode] = useState<LabExit | null>(null);
  /** The case and options as they were when the case started: the report must not follow later changes on the screen. */
  const [reported, setReported] = useState<{ labCase: LabCase; options: LabOptions; exitMode: LabExit | null }>({ labCase: LAB_CASES[0], options: DEFAULT_LAB_OPTIONS, exitMode: null });
  const run = useRef<Running | null>(null);
  const frameHost = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const log = useCallback((text: string) => {
    // What arrives after Stop (the element's own `emptied`, for one) is not part of the case
    const startedAt = run.current?.startedAt;
    if (startedAt === undefined) return;
    setLines((previous) => [...previous.slice(-400), { at: performance.now() - startedAt, text }]);
  }, []);

  const readTimes = useCallback((): { audio: number | null; video: number | null } => {
    const current = run.current;
    let video: number | null = null;
    try {
      video = current?.player ? current.player.getCurrentTime() : null;
    } catch {
      video = null;
    }
    return { audio: current?.audio ? current.audio.currentTime : null, video };
  }, []);

  const describeState = useCallback((): string => {
    const current = run.current;
    const parts: string[] = [];
    if (current?.audio) {
      parts.push(`áudio ${current.audio.paused ? 'pausado' : 'tocando'} em ${current.audio.currentTime.toFixed(1)} s (readyState ${current.audio.readyState})`);
    }
    if (current?.player) {
      try {
        parts.push(`vídeo ${YT_STATES[current.player.getPlayerState()] ?? '?'} em ${current.player.getCurrentTime().toFixed(1)} s`);
      } catch {
        parts.push('vídeo sem resposta');
      }
    }
    const session = audioSession();
    parts.push(`audioSession ${session ? `${session.type ?? '?'}/${session.state ?? '?'}` : 'indisponível'}`);
    parts.push(`mediaSession ${'mediaSession' in navigator ? navigator.mediaSession.playbackState : 'indisponível'}`);
    return parts.join('; ');
  }, []);

  const stop = useCallback(() => {
    timers.current.splice(0).forEach(clearTimeout);
    const current = run.current;
    run.current = null;
    if (!current) return;
    current.audio?.pause();
    current.audio?.removeAttribute('src');
    current.audio?.load();
    try {
      current.player?.stopVideo();
    } catch {
      // the frame may be gone already
    }
    current.iframe?.remove();
    if (current.silentUrl.startsWith('blob:')) URL.revokeObjectURL(current.silentUrl);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  // What the page sees when it leaves and comes back, with the numbers that tell whether the sound went on
  useEffect(() => {
    let left: { at: number; audio: number | null; video: number | null } | null = null;
    const onChange = () => {
      if (!run.current) return;
      timers.current.splice(0).forEach(clearTimeout);
      if (document.visibilityState === 'hidden') {
        const times = readTimes();
        left = { at: Date.now(), ...times };
        log(`SAIU DO APP — ${describeState()}`);
        // How late the page's own clock ran tells whether the system froze the page (a frozen page answers only after it is back)
        [1500, 4000, 15000].forEach((ms) => {
          const due = performance.now() + ms;
          timers.current.push(setTimeout(() => log(`${ms / 1000} s fora (relógio da página atrasado ${Math.max(0, Math.round(performance.now() - due))} ms) — ${describeState()}`), ms));
        });
        return;
      }
      if (!left) return;
      const away = Math.round((Date.now() - left.at) / 1000);
      const times = readTimes();
      log(`VOLTOU depois de ${away} s — áudio avançou ${describeAdvance(left.audio, times.audio)}, vídeo avançou ${describeAdvance(left.video, times.video)}`);
      log(`ao voltar — ${describeState()}`);
      timers.current.push(setTimeout(() => log(`2 s depois de voltar — ${describeState()}`), 2000));
      left = null;
    };
    const onFreeze = () => run.current && log('o sistema congelou a página (freeze)');
    const onResume = () => run.current && log('a página voltou do congelamento (resume)');
    document.addEventListener('visibilitychange', onChange);
    document.addEventListener('freeze', onFreeze);
    document.addEventListener('resume', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
      document.removeEventListener('freeze', onFreeze);
      document.removeEventListener('resume', onResume);
    };
  }, [describeState, log, readTimes]);

  // A touch anywhere asks the player to start again, as the app's own player does: the first playVideo() runs when the
  // player is ready, after the tap on Start, and the iPhone refuses it (report of case D, 2026-11-02)
  useEffect(() => {
    if (!running) return;
    const onTouch = () => {
      const current = run.current;
      if (!current?.player || !current.labCase.frame) return;
      const now = performance.now();
      if (!shouldNudge(current.videoStarted, current.lastNudgeAt, now)) return;
      current.lastNudgeAt = now;
      log('toque na tela: playVideo() de novo');
      try {
        current.player.playVideo();
      } catch {
        log('toque na tela: o player não respondeu');
      }
    };
    const types = ['pointerup', 'touchend', 'click'] as const;
    types.forEach((type) => document.addEventListener(type, onTouch, true));
    return () => types.forEach((type) => document.removeEventListener(type, onTouch, true));
  }, [running, log]);

  /** Creates the audio element of a case and starts it (inside a tap: the first tap of the case, or the button of case H). */
  const attachAudio = (current: Running, kind: 'radio' | 'silent', radio: string | null) => {
    const audio = new Audio();
    current.audio = audio;
    audio.preload = 'auto';
    if (kind === 'silent') {
      current.silentUrl = generateSilentWavBlobUrl(SILENT_SECONDS);
      audio.src = current.silentUrl;
      audio.loop = true;
    } else {
      audio.src = radio as string;
    }
    for (const name of ['playing', 'pause', 'waiting', 'stalled', 'ended', 'error', 'emptied', 'suspend'] as const) {
      audio.addEventListener(name, () => log(`áudio: evento ${name} (${audio.paused ? 'pausado' : 'tocando'}, ${audio.currentTime.toFixed(1)} s, readyState ${audio.readyState})`));
    }
    log(`áudio: play() pedido${current.videoStarted ? ' com o vídeo tocando' : ''}`);
    audio.play().then(
      () => log('áudio: play() aceito'),
      (error: unknown) => log(`áudio: play() recusado (${error instanceof Error ? error.name : String(error)})`)
    );
  };

  const startLateRadio = () => {
    const current = run.current;
    const radio = parseStreamUrl(radioText);
    if (!current || current.audio || !radio) return;
    attachAudio(current, 'radio', radio);
    setLateRadio(true);
  };

  const start = (labCase: LabCase) => {
    // Without the choice the report could not say how the app was left, and that may decide the result
    if (!exitMode) return setProblem('Escolha antes como você vai sair do app (trocar de app ou bloquear a tela).');
    stop();
    setProblem('');
    setLateRadio(false);
    setReported({ labCase, options: { ...options }, exitMode });
    const radio = parseStreamUrl(radioText);
    const video = parseVideoId(videoText);
    if ((labCase.audio === 'radio' || labCase.audio === 'radio-later') && !radio) return setProblem('Endereço da rádio inválido.');
    if (labCase.frame && !video) return setProblem('Vídeo inválido: cole o código de 11 caracteres ou o endereço do YouTube.');
    // The app's own player would be a second thing playing: stop it so the case is the only one
    if (isPlaying) togglePlayPause();

    const current: Running = { labCase, startedAt: performance.now(), audio: null, iframe: null, player: null, silentUrl: '', videoStarted: false, lastNudgeAt: 0 };
    run.current = current;
    setLines([]);
    setRunning(true);
    log(`caso ${labCase.id} iniciado no toque (app tocando antes: ${isPlaying ? 'sim, parado agora' : 'não'})`);

    if (options.audioSessionPlayback) {
      const session = audioSession();
      if (!session) log('audioSession indisponível: nada a pedir');
      else {
        try {
          session.type = 'playback';
          log(`audioSession.type = 'playback' pedido; lido de volta: ${session.type}/${session.state ?? '?'}`);
        } catch (error) {
          log(`audioSession.type recusado (${error instanceof Error ? error.name : String(error)})`);
        }
      }
    }
    if (options.mediaSession && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: `Laboratório · caso ${labCase.id}`, artist: 'Aurastream' });
      navigator.mediaSession.playbackState = 'playing';
      log('mediaSession: metadados publicados e playbackState = playing');
    }

    if (labCase.audio === 'radio' || labCase.audio === 'silent') attachAudio(current, labCase.audio, radio);

    if (labCase.frame && video) {
      const params = new URLSearchParams({ enablejsapi: '1', origin: window.location.origin, playsinline: '1', controls: '0', disablekb: '1', fs: '0', modestbranding: '1', rel: '0', autoplay: '1' });
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${video}?${params}`;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.title = `Laboratório · caso ${labCase.id}`;
      iframe.width = '320';
      iframe.height = '180';
      if (labCase.frame === 'visible') {
        Object.assign(iframe.style, { border: '0', borderRadius: '12px', maxWidth: '100%' });
        frameHost.current?.appendChild(iframe);
      } else {
        iframe.setAttribute('aria-hidden', 'true');
        // The same hiding the app uses (youtubeEngine.prime)
        Object.assign(iframe.style, { position: 'fixed', bottom: '0', right: '0', opacity: '0.001', pointerEvents: 'none', zIndex: '-50', clipPath: 'inset(100%)', border: '0' });
        document.body.appendChild(iframe);
      }
      current.iframe = iframe;
      log(`iframe criado (${labCase.frame === 'visible' ? 'visível' : 'oculto como no app'})`);
      loadApi()
        .then((YT) => {
          if (run.current !== current) return;
          current.player = new YT.Player(iframe, {
            events: {
              onReady: () => {
                log('vídeo: player pronto; playVideo()');
                current.player?.playVideo();
                // The iPhone starts a video only because of a touch: say so when it has not started
                timers.current.push(
                  setTimeout(() => {
                    if (run.current === current && !current.videoStarted) log('vídeo: 3 s sem começar — toque em qualquer ponto da tela (o iPhone só inicia vídeo por causa de um toque)');
                  }, 3000)
                );
              },
              onStateChange: (event) => {
                if (event.data === 1) current.videoStarted = true;
                log(`vídeo: ${YT_STATES[event.data] ?? event.data} (${current.player?.getCurrentTime().toFixed(1) ?? '?'} s)`);
              },
              onError: (event) => log(`vídeo: erro ${event.data} — ${describeYouTubeError(event.data)}`)
            }
          });
        })
        .catch(() => log('vídeo: a API do YouTube não carregou'));
    }
  };

  const retryVideo = () => {
    try {
      run.current?.player?.playVideo();
      log('toque manual: playVideo() de novo');
    } catch {
      log('toque manual: o player não respondeu');
    }
  };

  const report = formatLabReport(
    currentEnvironment(),
    reported.labCase,
    reported.options,
    [`saída: ${LAB_EXITS.find((entry) => entry.id === reported.exitMode)?.report ?? 'não informada'}`, `rádio: ${radioText.trim()}`, `vídeo: ${videoText.trim()}`],
    lines
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // the text is on the screen
    }
  };

  const toggle = (key: keyof LabOptions) => setOptions((previous) => ({ ...previous, [key]: !previous[key] }));

  return (
    <div
      role="dialog"
      aria-label="Laboratório de segundo plano"
      className="fixed inset-0 z-[70] overflow-y-auto bg-canvas animate-in fade-in"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto max-w-xl space-y-5 px-4 pb-10 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-bold leading-9 text-label">Laboratório</h2>
          <button
            onClick={() => {
              stop();
              onClose();
            }}
            aria-label="Fechar laboratório"
            className="rounded-full bg-fill-tertiary px-4 py-1.5 text-[15px] font-semibold text-accent"
          >
            OK
          </button>
        </div>

        <p className="text-[13px] leading-5 text-label-secondary">
          Escolha um caso, toque em Iniciar, confirme que está tocando (nos casos com YouTube, toque em qualquer ponto da tela se o vídeo não começar: o iPhone só inicia vídeo por causa de um toque), saia do app por 30 s, volte e copie o relatório. Faça no app instalado e
          repita no navegador. Um caso por vez: iniciar outro encerra o anterior.
        </p>

        <section aria-label="Casos" className="divide-y divide-separator overflow-hidden rounded-card bg-elevated">
          {LAB_CASES.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setSelected(entry)}
              aria-pressed={selected.id === entry.id}
              className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left ${selected.id === entry.id ? 'bg-fill-tertiary' : ''}`}
            >
              <span className="text-[15px] font-semibold text-label">{entry.label}</span>
              <span className="text-[12px] text-label-secondary">{entry.detail}</span>
            </button>
          ))}
        </section>

        <section aria-label="Opções" className="divide-y divide-separator overflow-hidden rounded-card bg-elevated">
          {([
            ['audioSessionPlayback', "audioSession.type = 'playback'"],
            ['mediaSession', 'Controles da tela de bloqueio (mediaSession)']
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-label">
              <span>{label}</span>
              <input type="checkbox" role="switch" checked={options[key]} onChange={() => toggle(key)} className="h-5 w-5 accent-[var(--accent)]" />
            </label>
          ))}
          <div className="space-y-2 px-4 py-3">
            <label className="block text-[12px] text-label-secondary">
              Rádio (endereço do stream)
              <input value={radioText} onChange={(event) => setRadioText(event.target.value)} className="mt-1 w-full rounded-lg bg-fill-tertiary px-3 py-2 text-[14px] text-label" />
            </label>
            <label className="block text-[12px] text-label-secondary">
              Vídeo do YouTube (código ou endereço)
              <input value={videoText} onChange={(event) => setVideoText(event.target.value)} className="mt-1 w-full rounded-lg bg-fill-tertiary px-3 py-2 text-[14px] text-label" />
            </label>
          </div>
        </section>

 
        <section aria-label="Saída do app" className="divide-y divide-separator overflow-hidden rounded-card bg-elevated">
          <p className="px-4 pt-3 text-[12px] text-label-secondary">Como você vai sair do app neste teste? Escolha antes de iniciar: o relatório registra a escolha (trocar de app e bloquear a tela podem se comportar de forma diferente).</p>
          {LAB_EXITS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setExitMode(entry.id)}
              aria-pressed={exitMode === entry.id}
              className={`flex w-full items-center px-4 py-3 text-left text-[15px] text-label ${exitMode === entry.id ? 'bg-fill-tertiary font-semibold' : ''}`}
            >
              {entry.label}
            </button>
          ))}
        </section>

        {problem && <p role="alert" className="text-[13px] text-rose-500">{problem}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => start(selected)} disabled={!exitMode} className="rounded-xl bg-fill-tertiary py-3 text-[17px] font-semibold text-accent disabled:opacity-40 active:scale-[0.98]">
            Iniciar caso {selected.id}
          </button>
          <button onClick={stop} disabled={!running} className="rounded-xl bg-fill-tertiary py-3 text-[17px] font-semibold text-label disabled:opacity-40 active:scale-[0.98]">
            Parar
          </button>
        </div>
        {running && selected.audio === 'radio-later' && !lateRadio && (
          <button onClick={startLateRadio} className="w-full rounded-xl bg-fill-tertiary py-2 text-[15px] font-semibold text-accent">
            Tocar a rádio agora (com o vídeo tocando)
          </button>
        )}
        {running && selected.frame && (
          <button onClick={retryVideo} className="w-full rounded-xl bg-fill-tertiary py-2 text-[15px] font-semibold text-accent">
            O vídeo não começou: tocar de novo
          </button>
        )}

        <div ref={frameHost} aria-label="Vídeo do caso" className="flex justify-center" />

        <section aria-label="Relatório" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] uppercase tracking-wide text-label-secondary">Relatório {running ? `· ${formatLabClock(lines.length ? lines[lines.length - 1].at : 0)}` : ''}</h3>
            <button onClick={copy} className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre data-testid="lab-report" className="max-h-80 overflow-auto whitespace-pre-wrap rounded-card bg-elevated p-3 text-[11px] leading-4 text-label">{report}</pre>
        </section>
      </div>
    </div>
  );
};
