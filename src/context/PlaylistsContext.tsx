import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Track } from '../types/music';
import { useAuth } from './AuthContext';
import { emitUserDataChanged, onUserDataApplied } from '../utils/userDataEvents';
import { randomUuid } from '../utils/userData';
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  loadPlaylists,
  MAX_PLAYLISTS,
  playlistHasTrack,
  removeTrackFromPlaylist,
  renamePlaylist,
  savePlaylists,
  type Playlist
} from '../utils/playlists';

interface PlaylistsContextType {
  playlists: Playlist[];
  /** Creates a playlist (with `firstTrack` in it, if given) and returns its id; null at the limit. */
  createNew: (name: string, firstTrack?: Track) => string | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  /** Adds the track to the playlist, or takes it out when it is already there. */
  toggleTrack: (id: string, track: Track) => void;
  removeTrack: (id: string, trackId: string) => void;
  /** Opens the "Adicionar à playlist" sheet for a track. */
  openAddToPlaylist: (track: Track) => void;
  /** The track the sheet is open for; null when it is closed. */
  sheetTrack: Track | null;
  closeAddToPlaylist: () => void;
}

const PlaylistsContext = createContext<PlaylistsContextType | null>(null);

// A uuid: it is also the playlist's id in the account
const newId = randomUuid;

export const PlaylistsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { storage } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists(storage));
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);

  useEffect(() => {
    savePlaylists(storage, playlists);
    emitUserDataChanged();
  }, [playlists, storage]);

  // The account's playlists arrived (or changed on another device)
  useEffect(() => onUserDataApplied(() => setPlaylists(loadPlaylists(storage))), [storage]);

  const createNew = useCallback(
    (name: string, firstTrack?: Track): string | null => {
      if (playlists.length >= MAX_PLAYLISTS) return null;
      const id = newId();
      setPlaylists((current) => {
        const next = createPlaylist(current, name, id, Date.now());
        if (!next) return current;
        return firstTrack ? addTrackToPlaylist(next, id, firstTrack) : next;
      });
      return id;
    },
    [playlists.length]
  );

  const rename = useCallback((id: string, name: string) => setPlaylists((c) => renamePlaylist(c, id, name)), []);
  const remove = useCallback((id: string) => setPlaylists((c) => deletePlaylist(c, id)), []);
  const removeTrack = useCallback((id: string, trackId: string) => setPlaylists((c) => removeTrackFromPlaylist(c, id, trackId)), []);
  const toggleTrack = useCallback(
    (id: string, track: Track) =>
      setPlaylists((c) =>
        playlistHasTrack(c.find((p) => p.id === id), track.id) ? removeTrackFromPlaylist(c, id, track.id) : addTrackToPlaylist(c, id, track)
      ),
    []
  );
  const openAddToPlaylist = useCallback((track: Track) => setSheetTrack(track), []);
  const closeAddToPlaylist = useCallback(() => setSheetTrack(null), []);

  const value = useMemo(
    () => ({ playlists, createNew, rename, remove, toggleTrack, removeTrack, openAddToPlaylist, sheetTrack, closeAddToPlaylist }),
    [playlists, createNew, rename, remove, toggleTrack, removeTrack, openAddToPlaylist, sheetTrack, closeAddToPlaylist]
  );

  return <PlaylistsContext.Provider value={value}>{children}</PlaylistsContext.Provider>;
};

export const usePlaylists = () => {
  const context = useContext(PlaylistsContext);
  if (!context) throw new Error('usePlaylists must be used within a PlaylistsProvider');
  return context;
};
