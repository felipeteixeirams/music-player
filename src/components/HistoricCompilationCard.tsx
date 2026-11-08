import React, { useState, useEffect } from 'react';
import { Play, Plus, Check, ChevronDown, ChevronUp, Disc3, Sparkles } from 'lucide-react';
import type { HistoricCompilation } from '../data/historicCompilations';
import type { Track } from '../types/music';
import { usePlaylists } from '../context/PlaylistsContext';
import { useAudio } from '../context/AudioContext';
import { prefetchResolved, formatTime } from '../utils/audioEngine';
import { RemoteImage } from './RemoteImage';

interface HistoricCompilationCardProps {
  compilation: HistoricCompilation;
  onPlay: (track: Track, queue: Track[]) => void;
}

export const HistoricCompilationCard: React.FC<HistoricCompilationCardProps> = ({
  compilation,
  onPlay
}) => {
  const { createWithTracks } = usePlaylists();
  const { currentTrack, isPlaying } = useAudio();
  const [expanded, setExpanded] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Aquece o cache de resolução dos primeiros vídeos da coletânea
    prefetchResolved(compilation.tracks.slice(0, 6));
  }, [compilation]);

  const isCurrentCompilationPlaying = compilation.tracks.some((t) => t.id === currentTrack?.id);

  const handlePlayAll = () => {
    if (compilation.tracks.length > 0) {
      onPlay(compilation.tracks[0], compilation.tracks);
    }
  };

  const handleSaveToLibrary = () => {
    const playlistName = `${compilation.title} (${compilation.label})`;
    const id = createWithTracks(playlistName, compilation.tracks);
    if (id) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <section
      aria-label={`Coletânea histórica ${compilation.title}`}
      className="mx-4 mb-5 overflow-hidden rounded-2xl border border-separator/40 bg-surface-elevated/80 backdrop-blur-xl shadow-xl transition-all"
    >
      {/* Cabeçalho do Card com gradiente temático */}
      <div className={`relative bg-gradient-to-br ${compilation.gradient} p-4.5 pb-4 text-white`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 border border-white/10 text-[11px] font-medium text-amber-300 mb-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Coletânea Histórica Detectada</span>
            </div>

            <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{compilation.title}</span>
              <span className="text-xs font-normal text-white/70 px-2 py-0.5 rounded bg-white/10">
                {compilation.badge}
              </span>
            </h3>

            <p className="text-xs font-medium text-white/90 mt-1 line-clamp-1">
              {compilation.subtitle}
            </p>
          </div>

          <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/20 bg-black/30">
            <RemoteImage
              src={compilation.coverUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <Disc3 className={`w-8 h-8 text-white/90 drop-shadow ${isCurrentCompilationPlaying && isPlaying ? 'animate-spin' : ''}`} />
            </div>
          </div>
        </div>

        <p className="text-[12px] text-white/70 mt-2.5 leading-relaxed">
          {compilation.description}
        </p>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3.5 pt-3 border-t border-white/10">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-md active:scale-95 transition-transform cursor-pointer"
            aria-label={`Ouvir CD Completo (${compilation.tracks.length} faixas)`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Ouvir CD Completo ({compilation.tracks.length} faixas)</span>
          </button>

          <button
            onClick={handleSaveToLibrary}
            disabled={savedSuccess}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
              savedSuccess
                ? 'bg-emerald-600/80 text-white border border-emerald-400/40'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/10'
            }`}
            aria-label={savedSuccess ? 'Salvo na Biblioteca!' : 'Salvar Playlist'}
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Salvo na Biblioteca!</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Salvar Playlist</span>
              </>
            )}
          </button>

          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="ml-auto flex items-center gap-1 text-[11px] text-white/80 hover:text-white py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Ocultar faixas' : 'Ver faixas'}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Lista de Faixas Expansível */}
      {expanded && (
        <div className="divide-y divide-separator/20 bg-black/20 p-2 text-xs">
          {compilation.tracks.map((track, idx) => {
            const isTrackPlaying = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                onClick={() => onPlay(track, compilation.tracks)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                  isTrackPlaying ? 'bg-accent/15 text-accent' : 'hover:bg-fill-tertiary text-label'
                }`}
              >
                <span className="w-5 text-center text-[11px] font-mono text-label-secondary shrink-0">
                  {idx + 1}
                </span>

                <div className="w-9 h-9 shrink-0 rounded-md overflow-hidden bg-fill-tertiary">
                  <RemoteImage
                    src={track.coverUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isTrackPlaying ? 'text-accent font-semibold' : 'text-label'}`}>
                    {track.title}
                  </p>
                  <p className="text-[11px] text-label-secondary truncate">
                    {track.artist}
                  </p>
                </div>

                <span className="text-[11px] text-label-secondary shrink-0 font-mono">
                  {formatTime(track.duration)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
