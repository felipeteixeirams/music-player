import React from 'react';
import { ArrowDownCircle, ChevronRight, Disc3, Mic2, Music2 } from 'lucide-react';
import type { Track } from '../types/music';
import { groupByAlbum, groupByArtist, tracksOf, type LibraryGroup, type LibraryView } from '../utils/library';
import { TrackList } from './TrackList';

interface LibraryScreenProps {
  view: LibraryView | null;
  onNavigate: (view: LibraryView) => void;
  liked: Track[];
  downloads: Track[];
  onPlay: (track: Track, queue: Track[]) => void;
}

const EMPTY_MESSAGES: Record<string, string> = {
  songs: 'Nenhuma música favoritada ainda. Toque no ícone de coração em qualquer faixa para salvar!',
  downloads: 'Nenhuma faixa baixada ainda. Toque no ícone de download em uma faixa para ouvi-la sem internet (só a prévia de 30s é salva).',
  artist: 'Nenhuma faixa deste artista nos favoritos.',
  album: 'Nenhuma faixa deste álbum nos favoritos.'
};

const Row: React.FC<{ icon?: React.ReactNode; cover?: string; round?: boolean; title: string; detail?: string; count: number; onClick: () => void }> = ({
  icon,
  cover,
  round,
  title,
  detail,
  count,
  onClick
}) => (
  <button
    onClick={onClick}
    className="relative w-full flex items-center gap-3 py-2.5 text-left active:bg-fill-tertiary transition-colors after:absolute after:bottom-0 after:left-[3.75rem] after:right-0 after:h-[0.5px] after:bg-separator"
  >
    {icon ? (
      <span className="w-12 flex justify-center text-accent shrink-0">{icon}</span>
    ) : (
      <span className={`w-12 h-12 shrink-0 overflow-hidden bg-elevated-2 ${round ? 'rounded-full' : 'rounded-cover'}`}>
        {cover && <img src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" />}
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="block text-[20px] text-label truncate">{title}</span>
      {detail && <span className="block text-[15px] text-label-secondary truncate">{detail}</span>}
    </span>
    <span className="text-[15px] text-label-secondary tabular-nums">{count}</span>
    <ChevronRight className="w-5 h-5 text-label-tertiary shrink-0" aria-hidden="true" />
  </button>
);

/** The Library tab: a menu of sections, as in Apple Music, and the screen of each one. */
export const LibraryScreen: React.FC<LibraryScreenProps> = ({ view, onNavigate, liked, downloads, onPlay }) => {
  if (view === null) {
    return (
      <nav className="px-4 py-2" aria-label="Seções da biblioteca">
        <Row icon={<Music2 className="w-6 h-6" />} title="Músicas favoritas" count={liked.length} onClick={() => onNavigate({ kind: 'songs' })} />
        <Row icon={<ArrowDownCircle className="w-6 h-6" />} title="Downloads" count={downloads.length} onClick={() => onNavigate({ kind: 'downloads' })} />
        <Row icon={<Mic2 className="w-6 h-6" />} title="Artistas" count={groupByArtist(liked).length} onClick={() => onNavigate({ kind: 'artists' })} />
        <Row icon={<Disc3 className="w-6 h-6" />} title="Álbuns" count={groupByAlbum(liked).length} onClick={() => onNavigate({ kind: 'albums' })} />
      </nav>
    );
  }

  if (view.kind === 'artists' || view.kind === 'albums') {
    const groups: LibraryGroup[] = view.kind === 'artists' ? groupByArtist(liked) : groupByAlbum(liked);
    if (groups.length === 0) {
      return (
        <p className="px-4 py-12 text-center text-[13px] text-label-secondary">
          {view.kind === 'artists' ? 'Os artistas aparecem aqui quando você favorita faixas.' : 'Os álbuns aparecem aqui quando você favorita faixas.'}
        </p>
      );
    }
    return (
      <div className="px-4 py-2">
        {groups.map((g) => (
          <Row
            key={`${g.name}\u0000${g.detail ?? ''}`}
            cover={g.coverUrl}
            round={view.kind === 'artists'}
            title={g.name}
            detail={g.detail}
            count={g.tracks.length}
            onClick={() =>
              onNavigate(view.kind === 'artists' ? { kind: 'artist', name: g.name } : { kind: 'album', name: g.name, artist: g.detail ?? '' })
            }
          />
        ))}
      </div>
    );
  }

  const tracks = tracksOf(view, liked, downloads);
  return (
    <TrackList
      tracks={tracks}
      emptyMessage={EMPTY_MESSAGES[view.kind]}
      onTrackSelect={(track) => onPlay(track, tracks)}
    />
  );
};
