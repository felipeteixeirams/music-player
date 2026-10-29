import React, { useState } from 'react';
import { ChevronRight, Clock, Disc3, ListMusic, Mic2, Music2, Pencil, Play, Plus, Podcast, Trash2 } from 'lucide-react';
import type { Track } from '../types/music';
import { groupByAlbum, groupByArtist, tracksOf, type LibraryGroup, type LibraryView } from '../utils/library';
import { TrackList } from './TrackList';
import { usePlaylists } from '../context/PlaylistsContext';
import { ConfirmDialog, NameDialog } from './Dialogs';
import { RemoteImage } from './RemoteImage';
import { usePodcastFollows } from '../hooks/usePodcastFollows';
import { ShowRow } from './PodcastsHome';
import type { PodcastShowSummary } from '../types/music';

interface LibraryScreenProps {
  view: LibraryView | null;
  onNavigate: (view: LibraryView) => void;
  liked: Track[];
  /** What the user played lately, newest first. */
  recent: Track[];
  onClearHistory: () => void;
  onPlay: (track: Track, queue: Track[]) => void;
  /** A followed show was tapped: its page opens. */
  onOpenShow: (show: PodcastShowSummary) => void;
}

const EMPTY_MESSAGES: Record<string, string> = {
  songs: 'Nenhuma música favoritada ainda. Toque no ícone de coração em qualquer faixa para salvar!',
  artist: 'Nenhuma faixa deste artista nos favoritos.',
  album: 'Nenhuma faixa deste álbum nos favoritos.'
};

const Row: React.FC<{ icon?: React.ReactNode; cover?: string; placeholder?: React.ReactNode; round?: boolean; title: string; detail?: string; count: number; onClick: () => void }> = ({
  icon,
  cover,
  placeholder,
  round,
  title,
  detail,
  count,
  onClick
}) => (
  <button
    onClick={onClick}
    className="relative w-full min-h-[52px] flex items-center gap-3 py-1.5 text-left active:bg-fill-tertiary transition-colors after:absolute after:bottom-0 after:left-[3.75rem] after:right-0 after:h-[0.5px] after:bg-separator"
  >
    {icon ? (
      <span className="w-12 flex justify-center text-accent shrink-0">{icon}</span>
    ) : (
      <span className={`w-12 h-12 shrink-0 overflow-hidden bg-elevated-2 ${round ? 'rounded-full' : 'rounded-cover'}`}>
        {cover ? (
          <RemoteImage src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          placeholder && <span className="w-full h-full flex items-center justify-center text-label-secondary">{placeholder}</span>
        )}
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="block text-[17px] text-label truncate">{title}</span>
      {detail && <span className="block text-[13px] text-label-secondary truncate">{detail}</span>}
    </span>
    <span className="text-[15px] text-label-secondary tabular-nums">{count}</span>
    <ChevronRight className="w-5 h-5 text-label-tertiary shrink-0" aria-hidden="true" />
  </button>
);

/** The Library tab: a menu of sections, as in Apple Music, and the screen of each one. */
export const LibraryScreen: React.FC<LibraryScreenProps> = ({ view, onNavigate, liked, recent, onClearHistory, onPlay, onOpenShow }) => {
  const { playlists, createNew, rename, remove, removeTrack } = usePlaylists();
  const follows = usePodcastFollows();
  const [dialog, setDialog] = useState<'create' | 'rename' | 'delete' | 'clear' | null>(null);

  if (view === null) {
    return (
      <nav className="px-4 py-2" aria-label="Seções da biblioteca">
        <Row icon={<ListMusic className="w-6 h-6" />} title="Playlists" count={playlists.length} onClick={() => onNavigate({ kind: 'playlists' })} />
        <Row icon={<Clock className="w-6 h-6" />} title="Reproduzidas recentemente" count={recent.length} onClick={() => onNavigate({ kind: 'recent' })} />
        <Row icon={<Music2 className="w-6 h-6" />} title="Músicas favoritas" count={liked.length} onClick={() => onNavigate({ kind: 'songs' })} />
        <Row icon={<Mic2 className="w-6 h-6" />} title="Artistas" count={groupByArtist(liked).length} onClick={() => onNavigate({ kind: 'artists' })} />
        <Row icon={<Disc3 className="w-6 h-6" />} title="Álbuns" count={groupByAlbum(liked).length} onClick={() => onNavigate({ kind: 'albums' })} />
        <Row icon={<Podcast className="w-6 h-6" />} title="Podcasts" count={follows.shows.length} onClick={() => onNavigate({ kind: 'podcasts' })} />
      </nav>
    );
  }

  if (view.kind === 'playlists') {
    return (
      <div className="px-4 py-2">
        <button
          onClick={() => setDialog('create')}
          className="relative w-full min-h-[52px] flex items-center gap-3 py-1.5 text-left active:bg-fill-tertiary transition-colors after:absolute after:bottom-[0.5px] after:left-[3.75rem] after:right-0 after:h-[0.5px] after:bg-separator"
        >
          <span className="w-12 h-12 shrink-0 rounded-cover bg-fill-tertiary text-accent flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </span>
          <span className="text-[17px] text-accent">Nova playlist</span>
        </button>

        {playlists.map((playlist) => (
          <Row
            key={playlist.id}
            cover={playlist.tracks[0]?.coverUrl}
            placeholder={<ListMusic className="w-5 h-5" />}
            title={playlist.name}
            count={playlist.tracks.length}
            onClick={() => onNavigate({ kind: 'playlist', id: playlist.id })}
          />
        ))}

        {playlists.length === 0 && (
          <p className="py-8 text-center text-[13px] text-label-secondary">
            Crie uma playlist e adicione faixas pelo botão de lista em qualquer música.
          </p>
        )}

        {dialog === 'create' && (
          <NameDialog
            title="Nova playlist"
            placeholder="Nome da playlist"
            confirmLabel="Criar"
            onClose={() => setDialog(null)}
            onSubmit={(name) => {
              const id = createNew(name);
              setDialog(null);
              if (id) onNavigate({ kind: 'playlist', id });
            }}
          />
        )}
      </div>
    );
  }

  if (view.kind === 'playlist') {
    const playlist = playlists.find((p) => p.id === view.id);
    if (!playlist) {
      return <p className="px-4 py-12 text-center text-[13px] text-label-secondary">Esta playlist não existe mais.</p>;
    }
    return (
      <div>
        <div className="px-4 pt-1 pb-2 flex items-center gap-2">
          <button
            onClick={() => playlist.tracks[0] && onPlay(playlist.tracks[0], playlist.tracks)}
            disabled={playlist.tracks.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent text-white text-[15px] font-semibold disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            Tocar
          </button>
          <button
            onClick={() => setDialog('rename')}
            aria-label="Renomear playlist"
            className="w-10 h-10 rounded-full bg-fill-tertiary text-label flex items-center justify-center active:scale-90 transition-transform"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDialog('delete')}
            aria-label="Apagar playlist"
            className="w-10 h-10 rounded-full bg-fill-tertiary text-label flex items-center justify-center active:scale-90 transition-transform"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <TrackList
          tracks={playlist.tracks}
          emptyMessage="Esta playlist está vazia. Toque no botão de lista em uma música para adicioná-la."
          onTrackSelect={(track) => onPlay(track, playlist.tracks)}
          onRemove={(track) => removeTrack(playlist.id, track.id)}
        />

        {dialog === 'rename' && (
          <NameDialog
            title="Renomear playlist"
            initial={playlist.name}
            confirmLabel="Salvar"
            onClose={() => setDialog(null)}
            onSubmit={(name) => {
              rename(playlist.id, name);
              setDialog(null);
            }}
          />
        )}
        {dialog === 'delete' && (
          <ConfirmDialog
            title="Apagar playlist?"
            message={`"${playlist.name}" será apagada da sua conta. As músicas continuam no app.`}
            confirmLabel="Apagar"
            onClose={() => setDialog(null)}
            onConfirm={() => {
              remove(playlist.id);
              setDialog(null);
              onNavigate({ kind: 'playlists' });
            }}
          />
        )}
      </div>
    );
  }

  if (view.kind === 'podcasts') {
    if (follows.shows.length === 0) {
      return (
        <p className="px-4 py-12 text-center text-[13px] text-label-secondary">
          Os programas que você segue aparecem aqui. Abra Buscar, toque em Podcasts e use Seguir na página de um programa.
        </p>
      );
    }
    return (
      <ul className="px-4 py-2" aria-label="Podcasts seguidos">
        {follows.shows.map((show) => (
          <li key={show.id}>
            <ShowRow show={show} onOpen={onOpenShow} />
          </li>
        ))}
      </ul>
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

  if (view.kind === 'recent') {
    return (
      <div>
        <div className="px-4 pt-1 pb-2 flex items-center gap-2">
          <button
            onClick={() => recent[0] && onPlay(recent[0], recent)}
            disabled={recent.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent text-white text-[15px] font-semibold disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            Tocar
          </button>
          <button
            onClick={() => setDialog('clear')}
            disabled={recent.length === 0}
            aria-label="Limpar histórico"
            className="w-10 h-10 rounded-full bg-fill-tertiary text-label flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <TrackList
          tracks={recent}
          emptyMessage="O que você ouvir aparece aqui, em todos os seus aparelhos."
          onTrackSelect={(track) => onPlay(track, recent)}
        />
        {dialog === 'clear' && (
          <ConfirmDialog
            title="Limpar histórico?"
            message="As faixas reproduzidas recentemente serão apagadas da sua conta. Favoritos e playlists não mudam."
            confirmLabel="Limpar"
            onClose={() => setDialog(null)}
            onConfirm={() => {
              onClearHistory();
              setDialog(null);
            }}
          />
        )}
      </div>
    );
  }

  const tracks = tracksOf(view, liked);
  return (
    <TrackList
      tracks={tracks}
      emptyMessage={EMPTY_MESSAGES[view.kind]}
      onTrackSelect={(track) => onPlay(track, tracks)}
    />
  );
};
