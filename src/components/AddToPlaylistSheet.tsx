import React, { useState } from 'react';
import { Check, Heart, ListMusic, Plus } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { usePlaylists } from '../context/PlaylistsContext';
import { playlistHasTrack } from '../utils/playlists';
import { NameDialog } from './Dialogs';
import { RemoteImage } from './RemoteImage';

/** Bottom sheet to put the track (opened with `openAddToPlaylist`) in a playlist, or take it out, or start a new one. */
export const AddToPlaylistSheet: React.FC = () => {
  const { sheetTrack, closeAddToPlaylist, playlists, toggleTrack, createNew } = usePlaylists();
  const { toggleLike, isLiked } = useAudio();
  const [creating, setCreating] = useState(false);

  if (!sheetTrack) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 animate-in fade-in" onClick={closeAddToPlaylist}>
        <div
          role="dialog"
          aria-label="Salvar em favoritos e playlists"
          className="absolute bottom-0 inset-x-0 mx-auto max-w-xl rounded-t-sheet px-4 pt-4 pb-[calc(var(--safe-bottom)+1rem)] max-h-[70vh] overflow-y-auto text-left animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 -z-10 rounded-t-sheet material-thick" aria-hidden="true" />

          <div className="flex items-center justify-between gap-3 pb-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold text-label">Conteúdo salvo em:</h2>
              <p className="text-[13px] text-label-secondary truncate">{sheetTrack.title} · {sheetTrack.artist}</p>
            </div>
            <button onClick={closeAddToPlaylist} className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label text-[15px] font-medium active:scale-95">
              Pronto
            </button>
          </div>

          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-3 py-2.5 text-left active:bg-fill-tertiary rounded-card"
          >
            <span className="w-11 h-11 rounded-cover bg-fill-tertiary text-accent flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-[17px] text-accent">Nova playlist</span>
          </button>

          <button
            onClick={() => toggleLike(sheetTrack)}
            aria-pressed={isLiked(sheetTrack.id)}
            className="w-full flex items-center gap-3 py-2.5 text-left active:bg-fill-tertiary rounded-card"
          >
            <span className="w-11 h-11 rounded-cover bg-accent text-white flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </span>
            <span className="min-w-0 flex-1 text-[17px] text-label truncate">Músicas curtidas</span>
            {isLiked(sheetTrack.id) ? (
              <Check className="w-5 h-5 text-accent shrink-0" aria-label="Já está nas músicas curtidas" />
            ) : (
              <Plus className="w-5 h-5 text-label-secondary shrink-0" aria-hidden="true" />
            )}
          </button>

          {playlists.map((playlist) => {
            const has = playlistHasTrack(playlist, sheetTrack.id);
            return (
              <button
                key={playlist.id}
                onClick={() => toggleTrack(playlist.id, sheetTrack)}
                aria-pressed={has}
                className="w-full flex items-center gap-3 py-2.5 text-left active:bg-fill-tertiary rounded-card"
              >
                <span className="w-11 h-11 rounded-cover bg-fill-tertiary text-label-secondary flex items-center justify-center shrink-0 overflow-hidden">
                  {playlist.tracks[0] ? (
                    <RemoteImage src={playlist.tracks[0].coverUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-5 h-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] text-label truncate">{playlist.name}</span>
                  <span className="block text-[13px] text-label-secondary">
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'faixa' : 'faixas'}
                  </span>
                </span>
                {has && <Check className="w-5 h-5 text-accent shrink-0" aria-label="Já está nesta playlist" />}
              </button>
            );
          })}

          {playlists.length === 0 && (
            <p className="text-[13px] text-label-secondary py-3">Você ainda não tem playlists. Crie a primeira acima.</p>
          )}
        </div>
      </div>

      {creating && (
        <NameDialog
          title="Nova playlist"
          placeholder="Nome da playlist"
          confirmLabel="Criar"
          onClose={() => setCreating(false)}
          onSubmit={(name) => {
            createNew(name, sheetTrack);
            setCreating(false);
          }}
        />
      )}
    </>
  );
};
