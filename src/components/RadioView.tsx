import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { LiveStation, RadioGenre, RadioStation } from '../types/music';
import { LIVE_RADIO_GROUPS } from '../data/liveRadios';
import { fetchLiveStations, fetchLiveStyles, fetchRadioGenres, reportLiveStationPlayed, type LiveStyleInfo } from '../utils/catalogClient';
import { StationTile } from './StationTile';

/** Stations by genre. Tapping one starts a radio: the queue renews itself, so the music does not stop. */
export const RadioView: React.FC = () => {
  const { radioStation, startRadio, isPlaying, isLive, currentTrack, startLiveRadio } = useAudio();
  const [genres, setGenres] = useState<RadioGenre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // More live stations, by style, from the directory (the curated list above stays when it is out)
  const [styles, setStyles] = useState<LiveStyleInfo[]>([]);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [styleStations, setStyleStations] = useState<LiveStation[]>([]);
  const [styleState, setStyleState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const controller = new AbortController();
    fetchLiveStyles(controller.signal).then(setStyles).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!styleId) return;
    const controller = new AbortController();
    setStyleState('loading');
    setStyleStations([]);
    fetchLiveStations(styleId, controller.signal)
      .then((stations) => {
        setStyleStations(stations);
        setStyleState('idle');
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setStyleState('error');
      });
    return () => controller.abort();
  }, [styleId]);

  const playLive = (station: LiveStation) => {
    startLiveRadio(station);
    reportLiveStationPlayed(station.id);
  };

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetchRadioGenres(controller.signal)
      .then((data) => {
        setGenres(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setError(err?.message || 'Não foi possível carregar as estações agora.');
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  const play = async (station: RadioStation) => {
    if (startingId !== null) return;
    setStartingId(station.id);
    setStartError(null);
    const started = await startRadio(station);
    setStartingId(null);
    if (!started) setStartError(`Não foi possível iniciar a rádio ${station.name} agora. Tente de novo.`);
  };

  return (
    <section className="px-4 py-3 space-y-6" aria-label="Rádio">
      {/* Live broadcasts: what is on the air now, with no timeline and nothing to skip */}
      <div aria-labelledby="live-heading" role="region" className="space-y-3">
        <div>
          <h2 id="live-heading" className="text-[22px] font-bold text-label tracking-tight">Ao vivo</h2>
          <p className="text-[13px] text-label-secondary mt-0.5">Você ouve o que está no ar agora, como no rádio.</p>
        </div>
        {LIVE_RADIO_GROUPS.map((group) => (
          <div key={group.id} role="group" aria-label={`Ao vivo: ${group.name}`}>
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-label-secondary mb-1.5">{group.name}</h3>
            <div className="grid grid-cols-3 gap-3">
              {group.stations.map((station: LiveStation) => {
                const isCurrent = isLive && currentTrack?.id === `live-${station.id}`;
                return (
                  <StationTile
                    key={station.id}
                    name={station.name}
                    seed={station.id}
                    label={isCurrent ? (isPlaying ? 'No ar agora' : 'Pausada') : station.location}
                    isCurrent={isCurrent}
                    isPlaying={isPlaying}
                    ariaLabel={`Ouvir ${station.name} ao vivo`}
                    onClick={() => startLiveRadio(station)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {styles.length > 0 && (
        <div role="region" aria-labelledby="live-style-heading" className="space-y-3">
          <div>
            <h2 id="live-style-heading" className="text-[22px] font-bold text-label tracking-tight">Mais rádios ao vivo</h2>
            <p className="text-[13px] text-label-secondary mt-0.5">Escolha um estilo e ouça emissoras de verdade, que continuam tocando com a tela bloqueada.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" role="group" aria-label="Estilos de rádio ao vivo">
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => setStyleId(style.id)}
                aria-pressed={styleId === style.id}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium active:scale-95 ${
                  styleId === style.id ? 'bg-accent text-white' : 'bg-fill-tertiary text-label'
                }`}
              >
                {style.name}
              </button>
            ))}
          </div>
          {styleState === 'loading' && (
            <p className="text-xs text-label-secondary" role="status">Procurando emissoras...</p>
          )}
          {styleState === 'error' && (
            <div className="text-xs text-rose-500 space-y-2" role="alert">
              <p>Não foi possível carregar as emissoras agora.</p>
              <button
                onClick={() => { const id = styleId; setStyleId(null); setTimeout(() => setStyleId(id), 0); }}
                className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label font-medium active:scale-95"
              >
                Tentar de novo
              </button>
            </div>
          )}
          {styleId && styleState === 'idle' && styleStations.length === 0 && (
            <p className="text-xs text-label-secondary">Nenhuma emissora disponível para este estilo agora.</p>
          )}
          {styleStations.length > 0 && (
            <div className="grid grid-cols-3 gap-3" role="group" aria-label="Emissoras do estilo">
              {styleStations.map((station) => {
                const isCurrent = isLive && currentTrack?.id === `live-${station.id}`;
                return (
                  <StationTile
                    key={station.id}
                    name={station.name}
                    seed={station.id}
                    label={isCurrent ? (isPlaying ? 'No ar agora' : 'Pausada') : station.location}
                    isCurrent={isCurrent}
                    isPlaying={isPlaying}
                    ariaLabel={`Ouvir ${station.name} ao vivo`}
                    onClick={() => playLive(station)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-[22px] font-bold text-label tracking-tight">Mix por gênero</h2>
        <p className="text-[13px] text-label-secondary mt-0.5">Uma fila de músicas que se renova sozinha, sem acabar.</p>
      </div>

      {startError && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{startError}</span>
        </div>
      )}

      {isLoading && (
        <div className="py-16 text-center text-label-secondary space-y-3" role="status">
          <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
          <p className="text-xs">Carregando estações...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="px-4 py-12 text-center text-xs text-rose-500 space-y-2" role="alert">
          <AlertCircle className="w-7 h-7 mx-auto" />
          <p>{error}</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="px-3.5 py-1.5 rounded-full bg-fill-tertiary hover:bg-fill-secondary text-label font-medium active:scale-95"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {genres.map((genre) => (
        <div key={genre.id} aria-label={genre.name} role="group">
          <h2 className="text-[22px] font-bold text-label tracking-tight mb-2.5">{genre.name}</h2>
          <div className="grid grid-cols-3 gap-3">
            {genre.stations.map((station) => {
              const isCurrent = radioStation?.id === station.id;
              const isStarting = startingId === station.id;
              return (
                <StationTile
                  key={station.id}
                  name={station.name}
                  seed={String(station.id)}
                  imageUrl={station.picture}
                  label={isStarting ? 'Iniciando...' : isCurrent ? (isPlaying ? 'Tocando agora' : 'Pausada') : 'Mix'}
                  isCurrent={isCurrent}
                  isPlaying={isPlaying}
                  disabled={startingId !== null && !isStarting}
                  ariaLabel={`Tocar a rádio ${station.name}`}
                  onClick={() => play(station)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};
