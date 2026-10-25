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
import { PlaybackNotice } from './PlaybackNotice';
import { useCoverColor } from '../hooks/useCoverColor';
import { isLiveTrack } from '../utils/liveRadio';

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
    audioFrequencyData,
    radioStation,
    isLive
  } = useAudio();

  const [activeTab, setActiveTab] = useState<'artwork' | 'lyrics' | 'visualizer'>('artwork');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [syncedLyrics, setSyncedLyrics] = useState<LrcLine[]>([]);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);

  React.useEffect(() => {
    if (!currentTrack) return;
    if (isLiveTrack(currentTrack)) {
      setSyncedLyrics([]);
      setIsFetchingLyrics(false);
      return;
    }
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

  const coverColor = useCoverColor(isExpanded ? currentTrack?.coverUrl : undefined);

  if (!isExpanded || !currentTrack) return null;

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = calculateProgress(displayTime, duration);
  const liked = isLiked(currentTrack.id);
  // A radio (live broadcast or endless station mix) has no timeline, shuffle, repeat or way back
  const isRadio = isLive || Boolean(radioStation);
  const shownTab = isLive && activeTab === 'lyrics' ? 'artwork' : activeTab;

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
      className="fixed inset-0 z-50 flex flex-col bg-canvas text-label overflow-hidden animate-in slide-in-from-bottom duration-300 select-none"
      style={{
        paddingTop: 'max(var(--safe-top), 12px)',
        paddingBottom: 'max(var(--safe-bottom), 20px)'
      }}
    >
      {/* Background: the cover's dominant color fading to black (neutral gray when the color cannot be read) */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-700"
        aria-hidden="true"
        style={{
          background: `linear-gradient(180deg, ${coverColor ?? 'rgb(44 44 46)'} 0%, color-mix(in srgb, ${coverColor ?? 'rgb(44 44 46)'} 45%, #000) 55%, #000 100%)`
        }}
      />

      {/* Main Container constrained to mobile/tablet ergonomics */}
      <div className="relative z-10 flex flex-col flex-1 max-w-lg w-full mx-auto px-5 py-3 justify-between">
        {/* 1. Top Bar */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => toggleExpanded(false)}
            aria-label="Minimizar player expandido"
            className="w-10 h-10 rounded-full material-ultrathin flex items-center justify-center text-label active:scale-90 transition-all"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="text-center">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-label-secondary">
              {isLive ? 'Rádio ao vivo' : radioStation ? 'Rádio' : 'Reproduzindo Agora'}
            </span>
            <p className="text-[13px] font-medium text-label truncate max-w-[180px]">
              {isLive ? currentTrack.title : radioStation ? radioStation.name : currentTrack.album}
            </p>
          </div>

          <div className="w-10 h-10 shrink-0" aria-hidden="true" />
        </div>

        {/* View Switcher Tabs (Artwork / Visualizer / Lyrics) */}
        <div className="flex items-center justify-center gap-0.5 my-2 material-ultrathin p-0.5 rounded-lg w-fit mx-auto">
          <button
            onClick={() => setActiveTab('artwork')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'artwork'
                ? 'bg-fill text-label shadow-sm font-semibold'
                : 'text-label-secondary hover:text-label'
            }`}
          >
            Capa
          </button>
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
              activeTab === 'visualizer'
                ? 'bg-fill text-label shadow-sm font-semibold'
                : 'text-label-secondary hover:text-label'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Frequência</span>
          </button>
          {!isLive && (
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
              activeTab === 'lyrics'
                ? 'bg-fill text-label shadow-sm font-semibold'
                : 'text-label-secondary hover:text-label'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Letra</span>
          </button>
          )}
        </div>

        {/* 2. Central Display (Artwork / Spectrum / Lyrics) */}
        <div className="flex-1 flex items-center justify-center my-2 max-h-[360px]">
          {shownTab === 'artwork' && (
            <div className="relative w-full max-w-[290px] aspect-square mx-auto">
              {/* The cover shrinks when paused and grows back on play, as in Apple Music */}
              <div
                className={`relative w-full h-full rounded-card overflow-hidden shadow-2xl shadow-black/60 transition-transform duration-500 bg-elevated-2 flex items-center justify-center ${
                  isPlaying ? 'scale-100' : 'scale-[0.86]'
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

          {shownTab === 'visualizer' && (
            <div className="w-full max-w-sm h-64 rounded-card material-ultrathin p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-label-secondary">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-accent" />
                  Visualizador
                </span>
                <span className="text-[11px] text-label-secondary">
                  {isPlaying ? 'Animação' : 'Pausado'}
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
                      background: 'rgb(255 255 255 / 0.85)'
                    }}
                  />
                ))}
              </div>

              <div className="text-center text-[11px] text-label-secondary">
                Animação decorativa: não mede o áudio que está tocando.
              </div>
            </div>
          )}

          {shownTab === 'lyrics' && (
            <div className="w-full max-w-sm h-72 rounded-card material-ultrathin p-4 overflow-y-auto text-left no-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-semibold text-label-secondary">Letra</h4>
                {isFetchingLyrics && <span className="text-[11px] text-label-secondary animate-pulse">Carregando...</span>}
              </div>
              {syncedLyrics.length > 0 ? (
                <div className="space-y-3 text-[15px] text-label-secondary leading-relaxed font-sans pb-10">
                  {syncedLyrics.map((line, idx) => {
                    const nextLineTime = syncedLyrics[idx + 1]?.time || 9999;
                    const isActive = currentTime >= line.time && currentTime < nextLineTime;
                    return (
                      <p
                        key={idx}
                        className={`transition-all duration-300 ${
                          isActive
                            ? 'text-label font-bold text-[17px] scale-[1.02] pl-2 border-l-2 border-accent'
                            : 'hover:text-label'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-[13px] text-label-secondary">
                    {isFetchingLyrics ? 'Buscando letra em tempo real...' : 'Letra instrumental ou não disponível para esta faixa.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <PlaybackNotice className="mb-2" />

        {/* 3. Metadata Row with Favorite Heart Button */}
        <div className="flex items-center justify-between my-2">
          <div className="min-w-0 pr-3 text-left">
            <h2 className="text-[22px] font-bold text-label truncate tracking-tight">
              {currentTrack.title}
            </h2>
            <p className="text-[20px] text-label-secondary truncate">{currentTrack.artist}</p>
          </div>

          {isLive ? (
            <div className="w-11 h-11 shrink-0" aria-hidden="true" />
          ) : (
          <button
            onClick={() => toggleLike(currentTrack)}
            aria-label={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            className="w-11 h-11 rounded-full material-ultrathin flex items-center justify-center shrink-0 active:scale-75 transition-all"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                liked ? 'fill-accent text-accent scale-110' : 'text-label'
              }`}
            />
          </button>
          )}
        </div>

        {/* 4. Timeline Progress Slider (a radio shows what it is instead) */}
        {isRadio ? (
          <div className="my-2 flex items-center justify-center h-[42px]" role="status">
            {isLive ? (
              <span className="flex items-center gap-2 rounded-full material-ultrathin px-3 py-1 text-[11px] font-bold tracking-widest text-label">
                <span className={`w-2 h-2 rounded-full bg-accent ${isPlaying ? 'animate-pulse' : 'opacity-50'}`} aria-hidden="true" />
                AO VIVO
              </span>
            ) : (
              <span className="flex items-center gap-2 rounded-full material-ultrathin px-3 py-1 text-[13px] font-semibold text-label">
                <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                Rádio {radioStation?.name}
              </span>
            )}
          </div>
        ) : (
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
              className="w-full h-1 rounded-full appearance-none cursor-pointer accent-white focus:outline-none"
              style={{
                background: `linear-gradient(to right, #fff 0%, #fff ${progressPercent}%, rgba(255, 255, 255, 0.3) ${progressPercent}%, rgba(255, 255, 255, 0.3) 100%)`
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-label-secondary tabular-nums">
            <span>{formatTime(displayTime)}</span>
            <span>{formatRemainingTime(displayTime, duration)}</span>
          </div>
        </div>
        )}

        {/* 5. Centralized Geometric Media Controls */}
        <div className="flex items-center justify-between px-2 my-2">
          {/* Shuffle Button */}
          {isRadio ? <div className="w-11 h-11" aria-hidden="true" /> : (
          <button
            onClick={toggleShuffle}
            aria-label={isShuffle ? 'Desativar modo aleatório' : 'Ativar modo aleatório'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isShuffle ? 'text-accent' : 'text-label-secondary hover:text-label'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>
          )}

          {/* Previous Track Button */}
          {isRadio ? <div className="w-12 h-12" aria-hidden="true" /> : (
          <button
            onClick={playPrevious}
            aria-label="Faixa anterior"
            className="w-12 h-12 rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
          >
            <SkipBack className="w-8 h-8 fill-current" />
          </button>
          )}

          {/* Prominent Play/Pause Button (68px Circular) */}
          <button
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pausar reprodução' : 'Iniciar reprodução'}
            className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-11 h-11 fill-current" />
            ) : (
              <Play className="w-11 h-11 fill-current ml-1" />
            )}
          </button>

          {/* Next Track Button (a live broadcast has no next) */}
          {isLive ? <div className="w-12 h-12" aria-hidden="true" /> : (
          <button
            onClick={playNext}
            aria-label="Próxima faixa"
            className="w-12 h-12 rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
          >
            <SkipForward className="w-8 h-8 fill-current" />
          </button>
          )}

          {/* Repeat Button */}
          {isRadio ? <div className="w-11 h-11" aria-hidden="true" /> : (
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
                ? 'text-accent'
                : 'text-label-secondary hover:text-label'
            }`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
          )}
        </div>

        {/* 6. Volume Scrub Bar */}
        <div className="flex items-center gap-3 px-2 pt-1 pb-1">
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
            className="text-label-secondary hover:text-label p-1"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-accent" />
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
            className="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/30 accent-white focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
