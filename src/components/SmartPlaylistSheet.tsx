import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Music2, Pause, Play, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import type { Track } from '../types/music';
import { apiFetch } from '../utils/apiFetch';
import { RemoteImage } from './RemoteImage';

interface SmartPlaylistSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, tracks: Track[]) => void;
}

interface ValidationData {
  passed: boolean;
  criteriaMet: string[];
  confidenceScore: number;
  varietyScore: number;
  deliveredCount: number;
  excludedTypes: string[];
}

interface SmartPlaylistResponse {
  title: string;
  description: string;
  prompt: string;
  tracks: Track[];
  validation: ValidationData;
}

const SAMPLE_PROMPTS = [
  'Rock acústico dos anos 90',
  'Samba de raiz e pagode de domingo',
  'Synthwave e retrowave para correr',
  'Jazz e bossa nova instrumental para foco',
  'Indie rock brasileiro animado'
];

const TARGET_COUNTS = [10, 15, 20, 25];

export const SmartPlaylistSheet: React.FC<SmartPlaylistSheetProps> = ({ isOpen, onClose, onSave }) => {
  const [step, setStep] = useState<'input' | 'generating' | 'preview'>('input');
  const [prompt, setPrompt] = useState('');
  const [targetCount, setTargetCount] = useState(15);
  const [loadingStage, setLoadingStage] = useState(0);
  const [result, setResult] = useState<SmartPlaylistResponse | null>(null);
  const [editableTitle, setEditableTitle] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop audio preview when closed or step changes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewingId(null);
  };

  const handleClose = () => {
    stopPreview();
    setError(null);
    setStep('input');
    onClose();
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

    audio.play().catch(() => {
      setPreviewingId(null);
    });
    audio.onended = () => {
      setPreviewingId(null);
    };
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);
    stopPreview();
    setStep('generating');
    setLoadingStage(1);

    const timer1 = setTimeout(() => setLoadingStage(2), 1500);
    const timer2 = setTimeout(() => setLoadingStage(3), 3200);

    try {
      const response = await apiFetch('/api/smart-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), targetCount })
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Não foi possível gerar a playlist. Tente novamente.');
      }

      const data: SmartPlaylistResponse = await response.json();
      if (!data.tracks || data.tracks.length === 0) {
        throw new Error('Nenhuma faixa musical foi encontrada para este pedido. Tente com outros termos.');
      }

      setResult(data);
      setEditableTitle(data.title);
      setTracks(data.tracks);
      setStep('preview');
    } catch (err) {
      setError((err as Error)?.message || 'Erro ao gerar playlist inteligente');
      setStep('input');
    }
  };

  const handleRemoveTrack = (trackId: string) => {
    if (previewingId === trackId) stopPreview();
    setTracks((curr) => curr.filter((t) => t.id !== trackId));
  };

  const handleConfirmSave = () => {
    stopPreview();
    const finalTitle = editableTitle.trim() || result?.title || 'Playlist Inteligente';
    onSave(finalTitle, tracks);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141418] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Drag handle on mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="text-[17px] font-semibold text-label">Playlist Inteligente</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-label-secondary hover:text-label active:scale-95 transition-transform"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-[13px] text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="smart-prompt" className="block text-[14px] font-medium text-label mb-1.5">
                  Como você quer a sua playlist?
                </label>
                <textarea
                  id="smart-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Ex.: Músicas anos 80 animadas com sintetizadores para treinar..."
                  className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-[15px] text-label placeholder-label-tertiary focus:outline-none focus:border-accent resize-none transition-colors"
                />
                <div className="text-right text-[11px] text-label-tertiary mt-1 tabular-nums">
                  {prompt.length}/300
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <span className="block text-[12px] font-medium text-label-secondary mb-2">
                  Sugestões de temas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setPrompt(sample)}
                      className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[12px] text-label-secondary hover:text-label transition-colors active:scale-95 text-left"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Track Count */}
              <div>
                <span className="block text-[13px] font-medium text-label mb-2">
                  Tamanho da playlist:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {TARGET_COUNTS.map((count) => {
                    const isSelected = targetCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setTargetCount(count)}
                        className={`py-2 px-3 rounded-xl text-[13px] font-medium border transition-colors ${
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-white/5 text-label-secondary border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {count} faixas
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note about exclusions */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[12px] text-label-secondary space-y-1">
                <p>• Faixas reais localizadas diretamente no catálogo musical.</p>
                <p>• Exclusão estrita de podcasts, programas falados e listas prontas.</p>
                <p>• Máximo de 2 faixas do mesmo artista para variedade.</p>
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                disabled={!prompt.trim()}
                onClick={handleGenerate}
                className="w-full h-12 rounded-2xl bg-accent text-white font-medium text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Gerar Playlist</span>
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-5">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                <Sparkles className="w-6 h-6 text-accent absolute" />
              </div>

              <div className="space-y-2 max-w-xs">
                <h3 className="text-[17px] font-semibold text-label">Criando sua playlist...</h3>
                <p className="text-[13px] text-label-secondary">
                  {loadingStage === 1 && 'Compreendendo estilo, ritmo e época do pedido...'}
                  {loadingStage === 2 && 'Buscando músicas individuais no catálogo (Deezer/iTunes)...'}
                  {loadingStage >= 3 && 'Validando critérios e variedade (sem podcasts, sem listas prontas)...'}
                </p>
              </div>

              <div className="flex gap-1.5 pt-2">
                <span className={`w-2 h-2 rounded-full transition-colors ${loadingStage >= 1 ? 'bg-accent' : 'bg-white/20'}`} />
                <span className={`w-2 h-2 rounded-full transition-colors ${loadingStage >= 2 ? 'bg-accent' : 'bg-white/20'}`} />
                <span className={`w-2 h-2 rounded-full transition-colors ${loadingStage >= 3 ? 'bg-accent' : 'bg-white/20'}`} />
              </div>
            </div>
          )}

          {step === 'preview' && result && (
            <div className="space-y-4">
              {/* Playlist Title & Description */}
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  className="w-full text-[19px] font-bold text-label bg-transparent border-b border-transparent hover:border-white/20 focus:border-accent focus:outline-none transition-colors"
                  placeholder="Nome da playlist"
                />
                <p className="text-[13px] text-label-secondary">{result.description}</p>
              </div>

              {/* Validation Summary Card */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-[13px] font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Montagem verificada e aprovada</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-[12px] text-label-secondary pl-6">
                  {result.validation.criteriaMet.map((crit, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-emerald-400">✓</span>
                      <span>{crit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Track count indicator */}
              <div className="flex items-center justify-between text-[13px] text-label-secondary pt-1">
                <span>{tracks.length} faixas selecionadas</span>
                <span className="text-[12px] text-label-tertiary">Toque no ▶ para ouvir prévia de 30s</span>
              </div>

              {/* Track List */}
              <div className="divide-y divide-white/5 max-h-[36vh] overflow-y-auto rounded-2xl bg-white/[0.02] border border-white/5">
                {tracks.map((track) => {
                  const isPreviewPlaying = previewingId === track.id;
                  return (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-white/5 transition-colors"
                    >
                      {/* Play Preview Button / Cover */}
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(track)}
                        className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-white/10 group flex items-center justify-center"
                        aria-label={isPreviewPlaying ? 'Pausar prévia' : 'Tocar prévia'}
                      >
                        {track.coverUrl ? (
                          <RemoteImage
                            src={track.coverUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music2 className="w-5 h-5 text-label-secondary" />
                        )}
                        <span className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                          isPreviewPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-active:opacity-100'
                        }`}>
                          {isPreviewPlaying ? (
                            <Pause className="w-5 h-5 text-white" />
                          ) : (
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          )}
                        </span>
                      </button>

                      {/* Track Details */}
                      <div className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-label truncate">
                          {track.title}
                        </span>
                        <span className="block text-[12px] text-label-secondary truncate">
                          {track.artist}
                        </span>
                      </div>

                      {/* Duration */}
                      <span className="text-[12px] text-label-tertiary tabular-nums shrink-0">
                        {Math.floor(track.duration / 60)}:
                        {String(track.duration % 60).padStart(2, '0')}
                      </span>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(track.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-label-tertiary hover:text-red-400 transition-colors"
                        aria-label="Remover faixa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={tracks.length === 0}
                  className="flex-1 h-12 rounded-2xl bg-accent text-white font-medium text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-accent/20 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Salvar na Biblioteca</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPreview();
                    setStep('input');
                  }}
                  className="h-12 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-label-secondary text-[14px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Novo Pedido</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
