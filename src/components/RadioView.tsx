import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Radio } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { RadioGenre, RadioStation } from '../types/music';
import { fetchRadioGenres } from '../utils/catalogClient';

/** Stations by genre. Tapping one starts a radio: the queue renews itself, so the music does not stop. */
export const RadioView: React.FC = () => {
  const { radioStation, startRadio, isPlaying } = useAudio();
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
          <Radio className="w-5 h-5 text-purple-400" />
          Rádio
        </h1>
        <p className="text-[11px] text-white/50 mt-0.5">
          Escolha uma estação e a música não para: a fila se renova sozinha.
        </p>
      </div>

      {startError && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{startError}</span>
        </div>
      )}

      {isLoading && (
        <div className="py-16 text-center text-white/50 space-y-3" role="status">
          <Loader2 className="w-7 h-7 text-purple-400 animate-spin mx-auto" />
          <p className="text-xs">Carregando estações...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="px-4 py-12 text-center text-xs text-rose-300 space-y-2" role="alert">
          <AlertCircle className="w-7 h-7 mx-auto" />
          <p>{error}</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium active:scale-95"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {genres.map((genre) => (
        <div key={genre.id} aria-label={genre.name} role="group">
          <h2 className="text-sm font-bold text-white tracking-tight mb-2.5">{genre.name}</h2>
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
                  className={`relative overflow-hidden rounded-3xl text-left border transition-all active:scale-[0.97] disabled:opacity-60 ${
                    isCurrent
                      ? 'border-purple-400/70 ring-1 ring-purple-400/50 bg-purple-950/30'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="aspect-square w-full bg-gradient-to-tr from-purple-900/50 to-pink-900/40 flex items-center justify-center">
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
                      <Radio className="w-8 h-8 text-white/40" />
                    )}
                  </div>
                  <div className="p-2">
                    <span className="block text-xs font-bold text-white truncate">{station.name}</span>
                    <span className="block text-[10px] text-white/50 mt-0.5">
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
