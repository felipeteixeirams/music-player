import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  Heart,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Layers,
  Radio,
  FileText,
  Activity,
  Sliders
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { formatTime, formatRemainingTime, calculateProgress, progressToSeconds } from '../utils/audioEngine';
import { fetchSyncedLyrics, LrcLine } from '../utils/lrclibClient';
import { AudioEngineBadge } from './AudioEngineBadge';

export const ExpandedPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    isExpanded,
    toggleExpanded,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    isLiked,
    activeEngine,
    audioFrequencyData
  } = useAudio();

  const [activeTab, setActiveTab] = useState<'artwork' | 'lyrics' | 'visualizer'>('artwork');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [syncedLyrics, setSyncedLyrics] = useState<LrcLine[]>([]);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);

  React.useEffect(() => {
    if (!currentTrack) return;
    let isMounted = true;
    setIsFetchingLyrics(true);
    setSyncedLyrics([]);

    fetchSyncedLyrics(currentTrack.artist, currentTrack.title).then((res) => {
      if (isMounted) {
        if (res.syncedLines.length > 0) {
          setSyncedLyrics(res.syncedLines);
        } else if (res.plainLyrics.length > 0) {
          setSyncedLyrics(res.plainLyrics.map((text, idx) => ({ time: idx * 5, text })));
        } else if (currentTrack.lyrics && currentTrack.lyrics.length > 0) {
          setSyncedLyrics(currentTrack.lyrics.map((text, idx) => ({ time: idx * 5, text })));
        }
        setIsFetchingLyrics(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentTrack]);

  if (!isExpanded || !currentTrack) return null;

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = calculateProgress(displayTime, duration);
  const liked = isLiked(currentTrack.id);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setScrubTime(progressToSeconds(val, duration));
  };

  const handleSliderCommit = () => {
    seekTo(scrubTime);
    setIsScrubbing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#07070d] text-white overflow-hidden animate-in slide-in-from-bottom duration-300 select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 12px)',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)'
      }}
    >
      {/* Dynamic Ambient Background Glow from Album Artwork */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 blur-3xl">
        <img
          src={currentTrack.coverUrl}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover scale-150 transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07070d]/60 via-[#07070d]/80 to-[#07070d]" />
      </div>

      {/* Main Container constrained to mobile/tablet ergonomics */}
      <div className="relative z-10 flex flex-col flex-1 max-w-lg w-full mx-auto px-5 py-3 justify-between">
        {/* 1. Top Bar */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => toggleExpanded(false)}
            aria-label="Minimizar player expandido"
            className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="text-center">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Reproduzindo Agora
            </span>
            <p className="text-xs font-medium text-white/90 truncate max-w-[180px]">
              {currentTrack.album}
            </p>
          </div>

          <AudioEngineBadge />
        </div>

        {/* View Switcher Tabs (Artwork / Visualizer / Lyrics) */}
        <div className="flex items-center justify-center gap-1 my-2 bg-white/[0.04] p-1 rounded-2xl border border-white/10 w-fit mx-auto">
          <button
            onClick={() => setActiveTab('artwork')}
            className={`px-3 py-1 rounded-xl text-[11px] font-medium transition-all ${
              activeTab === 'artwork'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Capa
          </button>
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`px-3 py-1 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1 ${
              activeTab === 'visualizer'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Frequência</span>
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-3 py-1 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1 ${
              activeTab === 'lyrics'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Letra</span>
          </button>
        </div>

        {/* 2. Central Display (Artwork / Spectrum / Lyrics) */}
        <div className="flex-1 flex items-center justify-center my-2 max-h-[360px]">
          {activeTab === 'artwork' && (
            <div className="relative w-full max-w-[290px] aspect-square mx-auto">
              {/* Drop-Shadow Projected Behind */}
              <div
                className={`absolute inset-4 rounded-3xl blur-2xl transition-all duration-700 opacity-60 bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 ${
                  isPlaying ? 'scale-105 opacity-80' : 'scale-95 opacity-30'
                }`}
              />

              <div
                className={`relative w-full h-full rounded-3xl overflow-hidden border border-white/20 shadow-2xl shadow-purple-950/70 transition-transform duration-500 bg-gradient-to-tr from-purple-900/60 to-pink-900/60 flex items-center justify-center ${
                  isPlaying ? 'scale-100' : 'scale-[0.96]'
                }`}
              >
                <img
                  src={currentTrack.coverUrl}
                  alt={`Capa do álbum ${currentTrack.album}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'visualizer' && (
            <div className="w-full max-w-sm h-64 rounded-3xl bg-white/[0.03] border border-white/10 p-5 flex flex-col justify-between backdrop-blur-xl">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Espectrograma Web Audio API
                </span>
                <span className="font-mono text-[10px] text-purple-400">
                  {isPlaying ? 'LIVE STREAMING' : 'PAUSADO'}
                </span>
              </div>

              {/* Dynamic Waveform Spectrum Bars */}
              <div className="flex items-end justify-between gap-1.5 h-36 px-2">
                {audioFrequencyData.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(6, val)}%`,
                      background: `linear-gradient(to top, #7c3aed, #ec4899, #06b6d4)`
                    }}
                  />
                ))}
              </div>

              <div className="text-center text-[11px] text-white/40">
                Análise em tempo real de resposta em frequência (20Hz - 20kHz)
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
            <div className="w-full max-w-sm h-72 rounded-3xl bg-white/[0.03] border border-white/10 p-4 overflow-y-auto backdrop-blur-xl text-left no-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-purple-400">Letra Sincronizada (LRCLIB)</h4>
                {isFetchingLyrics && <span className="text-[10px] text-white/40 animate-pulse">Carregando...</span>}
              </div>
              {syncedLyrics.length > 0 ? (
                <div className="space-y-3 text-xs text-white/60 leading-relaxed font-sans pb-10">
                  {syncedLyrics.map((line, idx) => {
                    const nextLineTime = syncedLyrics[idx + 1]?.time || 9999;
                    const isActive = currentTime >= line.time && currentTime < nextLineTime;
                    return (
                      <p
                        key={idx}
                        className={`transition-all duration-300 ${
                          isActive
                            ? 'text-white font-bold text-sm scale-[1.02] pl-2 border-l-2 border-purple-400'
                            : 'hover:text-white/90'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-xs text-white/50">
                    {isFetchingLyrics ? 'Buscando letra em tempo real...' : 'Letra instrumental ou não disponível para esta faixa.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Metadata Row with Favorite Heart Button */}
        <div className="flex items-center justify-between my-2">
          <div className="min-w-0 pr-3 text-left">
            <h2 className="text-lg font-bold text-white truncate tracking-tight">
              {currentTrack.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/60 truncate mt-0.5">
              <span>{currentTrack.artist}</span>
              <span aria-hidden="true">·</span>
              <span className="text-white/40">{currentTrack.style}</span>
              {currentTrack.releaseYear && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-white/40">{currentTrack.releaseYear}</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => toggleLike(currentTrack.id)}
            aria-label={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            className="w-11 h-11 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center shrink-0 active:scale-75 transition-all"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                liked ? 'fill-pink-500 text-pink-500 scale-110' : 'text-white/70'
              }`}
            />
          </button>
        </div>

        {/* 4. Timeline Progress Slider */}
        <div className="space-y-1.5 my-2">
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progressPercent}
              onChange={handleSliderChange}
              onMouseDown={() => setIsScrubbing(true)}
              onTouchStart={() => setIsScrubbing(true)}
              onMouseUp={handleSliderCommit}
              onTouchEnd={handleSliderCommit}
              aria-label="Linha do tempo da música"
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/20 accent-purple-500 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #a855f7 0%, #ec4899 ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%, rgba(255, 255, 255, 0.2) 100%)`
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/50 font-mono tabular-nums">
            <span>{formatTime(displayTime)}</span>
            <span>{formatRemainingTime(displayTime, duration)}</span>
          </div>
        </div>

        {/* 5. Centralized Geometric Media Controls */}
        <div className="flex items-center justify-between px-2 my-2">
          {/* Shuffle Button */}
          <button
            onClick={toggleShuffle}
            aria-label={isShuffle ? 'Desativar modo aleatório' : 'Ativar modo aleatório'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isShuffle ? 'text-purple-400 bg-purple-500/20' : 'text-white/60 hover:text-white'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Track Button */}
          <button
            onClick={playPrevious}
            aria-label="Faixa anterior"
            className="w-12 h-12 rounded-full flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          {/* Prominent Play/Pause Button (68px Circular) */}
          <button
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pausar reprodução' : 'Iniciar reprodução'}
            className="w-[68px] h-[68px] rounded-full flex items-center justify-center bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white shadow-xl shadow-purple-900/50 hover:scale-105 active:scale-95 transition-all ring-4 ring-white/10"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          {/* Next Track Button */}
          <button
            onClick={playNext}
            aria-label="Próxima faixa"
            className="w-12 h-12 rounded-full flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={toggleRepeat}
            aria-label={
              repeatMode === 'one'
                ? 'Repetindo a faixa atual'
                : repeatMode === 'all'
                ? 'Repetindo toda a lista'
                : 'Repetição desativada'
            }
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              repeatMode !== 'off'
                ? 'text-purple-400 bg-purple-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* 6. Volume Scrub Bar */}
        <div className="flex items-center gap-3 px-2 pt-1 pb-1">
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
            className="text-white/60 hover:text-white p-1"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-pink-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume da reprodução"
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 accent-white focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
