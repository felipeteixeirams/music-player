import React, { useEffect, useMemo, useState } from 'react';
import { Play, Plus, Check, ChevronDown, ChevronUp, Disc3 } from 'lucide-react';
import type { Track } from '../types/music';
import { usePlaylists } from '../context/PlaylistsContext';
import { useAudio } from '../context/AudioContext';
import { prefetchResolved, formatTime } from '../utils/audioEngine';
import { isPlaylistNameTaken } from '../utils/playlists';
import { durationSeconds, historicTrack, loadHistoricRecord, type HistoricEntry, type HistoricRecord } from '../utils/historicCatalog';

interface HistoricCompilationCardProps {
  entry: HistoricEntry;
  onPlay: (track: Track, queue: Track[]) => void;
}

/** One CD of the historic catalog: its tracks load when the card shows, and the card says how many the catalog confirmed. */
export const HistoricCompilationCard: React.FC<HistoricCompilationCardProps> = ({ entry, onPlay }) => {
  const { createWithTracks, playlists } = usePlaylists();
  const { currentTrack, isPlaying } = useAudio();
  const [record, setRecord] = useState<HistoricRecord | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const savedTimer = React.useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void loadHistoricRecord(entry.id).then((loaded) => {
      if (alive) setRecord(loaded);
    });
    return () => {
      alive = false;
    };
  }, [entry.id]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  const tracks = useMemo(() => (record ? record.tracks.map((line) => historicTrack(record, line)) : []), [record]);
  const playlistName = record ? `${record.title} (${record.label})` : entry.title;
  const isCurrentCompilationPlaying = tracks.some((t) => t.id === currentTrack?.id);

  useEffect(() => {
    // The first tracks of the CD are looked up ahead of the taps (the cache of the catalog, no search)
    if (tracks.length > 0) prefetchResolved(tracks.slice(0, 6));
  }, [tracks]);

  const showSaved = () => {
    setSavedSuccess(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSaveToLibrary = () => {
    // Saving the same CD twice would make two playlists with one name: the second press only shows the note
    if (isPlaylistNameTaken(playlists, playlistName)) {
      showSaved();
      return;
    }
    if (tracks.length > 0 && createWithTracks(playlistName, tracks)) showSaved();
  };

  const confirmed = record ? record.tracks.filter((line) => line.deezerId).length : entry.matched;
  const total = record ? record.tracks.length : entry.tracks;

  return (
    <section
      aria-label={`Coletânea histórica ${entry.title}`}
      className="mx-4 mb-5 overflow-hidden rounded-2xl border border-separator/40 bg-surface-elevated/80 shadow-xl transition-all"
    >
      <div className="relative bg-gradient-to-br from-amber-600/30 via-red-950/40 to-black p-4.5 pb-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 border border-white/10 text-[11px] font-medium text-amber-300 mb-2">
              <span>{`CD ${record?.label ?? 'Som Livre'}${entry.year ? ` · ${entry.year}` : ''}`}</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white">{record?.title ?? entry.title}</h3>
            {entry.catno && <p className="text-xs text-white/70 mt-1">Catálogo {entry.catno}</p>}
          </div>
          <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/20 bg-black/30 flex items-center justify-center">
            <Disc3 className={`w-8 h-8 text-white/90 drop-shadow ${isCurrentCompilationPlaying && isPlaying ? 'animate-spin' : ''}`} />
          </div>
        </div>

        <p className="text-[12px] text-white/70 mt-2.5 leading-relaxed">
          {total} faixas{confirmed > 0 ? `, ${confirmed} confirmadas no catálogo para tocar` : ''}.
        </p>

        <div className="flex flex-wrap items-center gap-2.5 mt-3.5 pt-3 border-t border-white/10">
          <button
            onClick={() => tracks.length > 0 && onPlay(tracks[0], tracks)}
            disabled={tracks.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold shadow-md active:scale-95 transition-transform cursor-pointer"
            aria-label={`Ouvir CD Completo (${total} faixas)`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Ouvir CD Completo ({total} faixas)</span>
          </button>

          <button
            onClick={handleSaveToLibrary}
            disabled={savedSuccess || tracks.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all active:scale-95 cursor-pointer ${
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

      {expanded && (
        <div className="divide-y divide-separator/20 bg-black/20 p-2 text-xs">
          {tracks.map((track, idx) => {
            const isTrackPlaying = currentTrack?.id === track.id;
            const line = record?.tracks[idx];
            return (
              <button
                key={track.id}
                onClick={() => onPlay(track, tracks)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer text-left ${
                  isTrackPlaying ? 'bg-accent/15 text-accent' : 'hover:bg-fill-tertiary text-label'
                }`}
              >
                <span className="w-5 text-center text-[11px] font-mono text-label-secondary shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isTrackPlaying ? 'text-accent font-semibold' : 'text-label'}`}>{track.title}</p>
                  <p className="text-[11px] text-label-secondary truncate">{track.artist}</p>
                </div>
                <span className="text-[11px] text-label-tertiary tabular-nums shrink-0">
                  {formatTime(durationSeconds(line?.duration ?? null))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

/** The CDs a search names: the first few at once, the rest behind a button (a series can have many volumes). */
export const HistoricCompilationList: React.FC<{ entries: HistoricEntry[]; onPlay: (track: Track, queue: Track[]) => void }> = ({
  entries,
  onPlay
}) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, FIRST_CARDS);
  return (
    <>
      {shown.map((entry) => (
        <HistoricCompilationCard key={entry.id} entry={entry} onPlay={onPlay} />
      ))}
      {!showAll && entries.length > FIRST_CARDS && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowAll(true)}
            className="w-full rounded-full bg-fill-tertiary py-2 text-[13px] font-semibold text-accent active:scale-[0.99]"
          >
            Mostrar mais {entries.length - FIRST_CARDS} CDs desta série
          </button>
        </div>
      )}
    </>
  );
};

const FIRST_CARDS = 3;
