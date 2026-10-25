import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Radio } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { LiveStation, RadioGenre, RadioStation } from '../types/music';
import { LIVE_RADIO_GROUPS } from '../data/liveRadios';
import { fetchRadioGenres } from '../utils/catalogClient';

/** Stations by genre. Tapping one starts a radio: the queue renews itself, so the music does not stop. */
export const RadioView: React.FC = () => {
  const { radioStation, startRadio, isPlaying, isLive, currentTrack, startLiveRadio } = useAudio();
  const [genres, setGenres] = useState<RadioGenre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

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
    <section className="px-4 py-3 space-y-5" aria-labelledby="radio-heading">
      <div>
        <h1 id="radio-heading" className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <Radio className="w-5 h-5 text-accent" />
          Rádio
        </h1>
        <p className="text-[13px] text-label-secondary mt-0.5">
          Rádios de verdade, ao vivo, ou um mix por gênero que não para.
        </p>
      </div>

      {/* Live broadcasts: what is on the air now, with no timeline and nothing to skip */}
      <div aria-labelledby="live-heading" role="region" className="space-y-3">
        <div>
          <h2 id="live-heading" className="text-[22px] font-bold text-label tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
            Ao vivo
          </h2>
          <p className="text-[13px] text-label-secondary mt-0.5">Você ouve o que está no ar agora, como no rádio.</p>
        </div>
        {LIVE_RADIO_GROUPS.map((group) => (
          <div key={group.id} role="group" aria-label={`Ao vivo: ${group.name}`}>
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-label-secondary mb-1.5">{group.name}</h3>
            <div className="grid grid-cols-2 gap-2">
              {group.stations.map((station: LiveStation) => {
                const isCurrent = isLive && currentTrack?.id === `live-${station.id}`;
                return (
                  <button
                    key={station.id}
                    onClick={() => startLiveRadio(station)}
                    aria-label={`Ouvir ${station.name} ao vivo`}
                    aria-pressed={isCurrent}
                    className={`text-left rounded-card px-3 py-2.5 transition-all active:scale-[0.97] ${
                      isCurrent
                        ? 'bg-elevated-2 ring-2 ring-accent'
                        : 'bg-elevated hover:bg-elevated-2'
                    }`}
                  >
                    <span className="block text-[15px] font-semibold text-label truncate">{station.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-label-secondary">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrent && isPlaying ? 'bg-accent animate-pulse' : 'bg-label-tertiary'}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{isCurrent ? (isPlaying ? 'No ar agora' : 'Pausada') : station.location}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

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
        <div className="px-4 py-12 text-center text-xs text-rose-300 space-y-2" role="alert">
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
          <div className="grid grid-cols-3 gap-2.5">
            {genre.stations.map((station) => {
              const isCurrent = radioStation?.id === station.id;
              const isStarting = startingId === station.id;
              return (
                <button
                  key={station.id}
                  onClick={() => play(station)}
                  disabled={startingId !== null && !isStarting}
                  aria-label={`Tocar a rádio ${station.name}`}
                  aria-pressed={isCurrent}
                  className={`relative overflow-hidden rounded-card text-left transition-all active:scale-[0.97] disabled:opacity-60 ${
                    isCurrent
                      ? 'bg-elevated-2 ring-2 ring-accent'
                      : 'bg-elevated hover:bg-elevated-2'
                  }`}
                >
                  <div className="aspect-square w-full bg-elevated-2 flex items-center justify-center">
                    {station.picture ? (
                      <img
                        src={station.picture}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Radio className="w-8 h-8 text-label-tertiary" />
                    )}
                  </div>
                  <div className="p-2">
                    <span className="block text-[15px] font-semibold text-label truncate">{station.name}</span>
                    <span className="block text-[13px] text-label-secondary mt-0.5">
                      {isStarting ? 'Iniciando...' : isCurrent ? (isPlaying ? 'Tocando agora' : 'Pausada') : 'Rádio'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};
