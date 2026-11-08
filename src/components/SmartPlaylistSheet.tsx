import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Music2, Pause, Play, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { Track } from '../types/music';
import { apiFetch } from '../utils/apiFetch';
import { isPlaylistNameTaken } from '../utils/playlists';
import { usePlaylists } from '../context/PlaylistsContext';
import { RemoteImage } from './RemoteImage';

interface SmartPlaylistSheetProps {
  /** Opens the new playlist (after saving it), in the library. */
  onOpenPlaylist: (id: string) => void;
}

/** Tracks for a new playlist, and for each "add more" batch (INV-SMART-05, INV-SMART-06). */
const PLAYLIST_SIZE = 10;
const ADD_MORE_SIZE = 5;

/** Short examples of requests: a tap fills the description (not a long list of options). */
const EXAMPLES = ['Rock dos anos 80 para correr', 'Bossa nova para um fim de tarde', 'Queen com as melhores músicas'];

interface SmartPlaylistResponse {
  title: string;
  description: string;
  prompt: string;
  tracks: Track[];
}

type Step = 'input' | 'generating' | 'preview';

/**
 * "Criar com IA": describe what you want, get 10 tracks, listen to a 30 s preview of each, remove the ones you do not
 * want, add 5 more with the same description, name it (unique among your playlists) and save. Opened from the library
 * and from the home screen (through the playlists context).
 */
export const SmartPlaylistSheet: React.FC<SmartPlaylistSheetProps> = ({ onOpenPlaylist }) => {
  const { playlists, createWithTracks, smartOpen, closeSmartPlaylist } = usePlaylists();
  const [step, setStep] = useState<Step>('input');
  const [prompt, setPrompt] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  /** Tracks the person removed in this sheet: "add more" never brings them back. */
  const [removed, setRemoved] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewingId(null);
  };

  // A preview never keeps playing after the sheet closes
  useEffect(() => () => stopPreview(), []);

  // Each opening starts from a clean sheet
  useEffect(() => {
    if (smartOpen) {
      setStep('input');
      setError(null);
      setAddError(null);
    }
  }, [smartOpen]);

  if (!smartOpen) return null;

  const close = () => {
    stopPreview();
    closeSmartPlaylist();
  };

  const requestTracks = async (body: Record<string, unknown>): Promise<SmartPlaylistResponse> => {
    const response = await apiFetch('/api/smart-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || 'Não foi possível montar a playlist. Tente de novo.');
    }
    const data = (await response.json()) as SmartPlaylistResponse;
    if (!data.tracks || data.tracks.length === 0) throw new Error('Nenhuma música encontrada para este pedido. Tente outras palavras.');
    return data;
  };

  const handleCreate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setError(null);
    stopPreview();
    setStep('generating');
    try {
      const data = await requestTracks({ prompt: text, targetCount: PLAYLIST_SIZE });
      setDescription(text);
      setTitle(data.title);
      setTracks(data.tracks);
      setRemoved([]);
      setStep('preview');
    } catch (err) {
      setError((err as Error).message);
      setStep('input');
    }
  };

  const handleAddMore = async () => {
    if (adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const data = await requestTracks({
        prompt: description,
        targetCount: ADD_MORE_SIZE,
        exclude: [...tracks, ...removed].map((t) => ({ id: t.id, title: t.title, artist: t.artist }))
      });
      // The server does not repeat what is listed; the same check here keeps the list right even if a batch races another
      const have = new Set(tracks.map((t) => t.id));
      setTracks((current) => [...current, ...data.tracks.filter((t) => !have.has(t.id))]);
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleTogglePreview = (track: Track) => {
    const url = track.sources?.previewUrl;
    if (!url) return;
    if (previewingId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const audio = new Audio(url);
    audioRef.current = audio;
    setPreviewingId(track.id);
    audio.play().catch(() => setPreviewingId(null));
    audio.onended = () => setPreviewingId(null);
  };

  const handleRemove = (trackId: string) => {
    if (previewingId === trackId) stopPreview();
    const gone = tracks.find((t) => t.id === trackId);
    if (gone) setRemoved((current) => [...current, gone]);
    setTracks((current) => current.filter((t) => t.id !== trackId));
  };

  const cleanTitle = title.trim();
  const titleTaken = isPlaylistNameTaken(playlists, cleanTitle);
  const canSave = cleanTitle.length > 0 && !titleTaken && tracks.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    stopPreview();
    const id = createWithTracks(cleanTitle, tracks);
    if (!id) {
      setError('Você atingiu o limite de playlists. Apague uma para criar outra.');
      return;
    }
    closeSmartPlaylist();
    onOpenPlaylist(id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141418] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
            <h2 className="text-[17px] font-semibold text-label">Criar com IA</h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-label-secondary hover:text-label active:scale-95 transition-transform"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-[13px] text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'input' && (
            <>
              <div>
                <label htmlFor="smart-prompt" className="block text-[15px] font-medium text-label mb-2">
                  Descreva a playlist
                </label>
                <textarea
                  id="smart-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Ex.: músicas calmas para estudar à noite"
                  className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-[15px] text-label placeholder-label-tertiary focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[12px] text-label-secondary active:scale-95 transition-transform"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!prompt.trim()}
                onClick={handleCreate}
                className="w-full h-12 rounded-2xl bg-accent text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Criar playlist</span>
              </button>
            </>
          )}

          {step === 'generating' && (
            <div className="py-14 flex flex-col items-center justify-center gap-4 text-center" role="status">
              <Loader2 className="w-7 h-7 text-accent animate-spin" aria-hidden="true" />
              <p className="text-[15px] text-label">Montando sua playlist…</p>
            </div>
          )}

          {step === 'preview' && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="smart-title" className="sr-only">Nome da playlist</label>
                <input
                  id="smart-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                  placeholder="Nome da playlist"
                  aria-invalid={titleTaken}
                  className="w-full text-[19px] font-bold text-label bg-transparent border-b border-white/15 focus:border-accent focus:outline-none transition-colors pb-1"
                />
                {titleTaken && <p className="text-[12px] text-red-400">Você já tem uma playlist com esse nome. Escolha outro.</p>}
              </div>

              <div className="flex items-center justify-between text-[13px] text-label-secondary">
                <span>{tracks.length} músicas</span>
                <span className="text-[12px] text-label-tertiary">Toque em ▶ para ouvir 30 s</span>
              </div>

              <div className="divide-y divide-white/5 max-h-[40vh] overflow-y-auto rounded-2xl bg-white/[0.02] border border-white/5">
                {tracks.map((track) => {
                  const playing = previewingId === track.id;
                  return (
                    <div key={track.id} className="flex items-center gap-3 p-2.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(track)}
                        className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-white/10 group flex items-center justify-center"
                        aria-label={playing ? `Pausar prévia de ${track.title}` : `Ouvir prévia de ${track.title}`}
                      >
                        {track.coverUrl ? (
                          <RemoteImage src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music2 className="w-5 h-5 text-label-secondary" />
                        )}
                        <span className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white fill-white ml-0.5" />}
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-label truncate">{track.title}</span>
                        <span className="block text-[12px] text-label-secondary truncate">{track.artist}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(track.id)}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-label-tertiary hover:text-red-400 transition-colors"
                        aria-label={`Remover ${track.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {addError && <p className="text-[12px] text-red-400">{addError}</p>}

              <button
                type="button"
                onClick={handleAddMore}
                disabled={adding}
                className="w-full h-11 rounded-2xl bg-white/5 hover:bg-white/10 text-label text-[14px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                <span>{adding ? 'Buscando mais…' : `Adicionar ${ADD_MORE_SIZE} músicas`}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="w-full h-12 rounded-2xl bg-accent text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-accent/20 disabled:opacity-40 disabled:shadow-none"
              >
                <span>Salvar na Biblioteca</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
