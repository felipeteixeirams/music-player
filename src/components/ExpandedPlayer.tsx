import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  Shuffle,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Radio,
  Replace,
  Plus,
  Check,
  MessageSquareQuote,
  ListMusic,
  MoreHorizontal,
  SearchX,
  Moon
} from 'lucide-react';
import { useAudio, usePlaybackTime } from '../context/AudioContext';
import { usePlaylists } from '../context/PlaylistsContext';
import { formatTime, formatRemainingTime, calculateProgress, progressToSeconds } from '../utils/audioEngine';
import { fetchSyncedLyrics, LrcLine } from '../utils/lrclibClient';
import { PlaybackNotice } from './PlaybackNotice';
import { useCoverColor } from '../hooks/useCoverColor';
import { isLiveTrack } from '../utils/liveRadio';
import { isPodcastTrack } from '../utils/podcastTrack';
import { speedLabel } from '../utils/podcastSpeed';
import { usePodcastFollows } from '../hooks/usePodcastFollows';
import { PlaybackIcon, playbackLabel, usePlaybackState } from './PlaybackIcon';
import { LyricsView } from './LyricsView';
import { QueueList } from './QueueList';
import { RemoteImage } from './RemoteImage';
import { ArtistAlbumActionSheet } from './ArtistAlbumActionSheet';
import { triggerHaptic } from '../utils/haptics';

interface ExpandedPlayerProps {
  onNavigateToArtist?: (artistName: string) => void;
  onNavigateToAlbum?: (albumTitle: string, artistName: string, coverUrl?: string) => void;
}

/** One line of the "Mais opções" menu. */
const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onSelect: () => void }> = ({ icon, label, onSelect }) => (
  <button
    role="menuitem"
    onClick={onSelect}
    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-label active:bg-fill-tertiary"
  >
    {icon}
    {label}
  </button>
);

/**
 * The slider and the two times: the only part of the player that follows the clock (about 4 times a second). It
 * subscribes to the clock itself, so the rest of the player does not render again on every tick.
 */
const PlaybackProgress: React.FC<{
  isScrubbing: boolean;
  scrubTime: number;
  onScrubStart: () => void;
  onScrubChange: (seconds: number) => void;
  onScrubCommit: () => void;
}> = ({ isScrubbing, scrubTime, onScrubStart, onScrubChange, onScrubCommit }) => {
  const { currentTime, duration } = usePlaybackTime();
  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = calculateProgress(displayTime, duration);

  return (
    <>
      <div className="relative flex items-center py-1">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progressPercent}
          onChange={(e) => onScrubChange(progressToSeconds(parseFloat(e.target.value), duration))}
          onMouseDown={onScrubStart}
          onTouchStart={onScrubStart}
          onMouseUp={onScrubCommit}
          onTouchEnd={onScrubCommit}
          aria-label="Linha do tempo da música"
          className={`w-full rounded-full appearance-none cursor-pointer accent-white focus:outline-none transition-[height] duration-150 ${
            isScrubbing ? 'h-1.5' : 'h-1'
          }`}
          style={{
            background: `linear-gradient(to right, #fff 0%, #fff ${progressPercent}%, rgba(255, 255, 255, 0.25) ${progressPercent}%, rgba(255, 255, 255, 0.25) 100%)`
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs tabular-nums transition-colors">
        <span className={isScrubbing ? 'text-label font-medium scale-105 transition-transform' : 'text-label-secondary'}>
          {formatTime(displayTime)}
        </span>
        <span className="text-label-secondary">
          {formatRemainingTime(displayTime, duration)}
        </span>
      </div>
    </>
  );
};

/** The lyrics view, which highlights the line being sung: the only other part that follows the clock. */
const SyncedLyrics: React.FC<Omit<React.ComponentProps<typeof LyricsView>, 'currentTime'>> = (props) => {
  const { currentTime } = usePlaybackTime();
  return <LyricsView {...props} currentTime={currentTime} />;
};

export const ExpandedPlayer: React.FC<ExpandedPlayerProps> = ({
  onNavigateToArtist,
  onNavigateToAlbum
}) => {
  const playback = usePlaybackState();
  const {
    currentTrack,
    currentIndex,
    queue,
    isPlaying,
    isShuffle,
    repeatMode,
    isExpanded,
    toggleExpanded,
    versionCount,
    switchVersion,
    markWrongVersion,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    isLiked,
    radioStation,
    isLive,
    playbackSpeed,
    cycleSpeed,
    skipBy,
    sleepTimerMinutes,
    remainingSleepSeconds,
    setSleepTimer
  } = useAudio();
  const { openAddToPlaylist, playlists } = usePlaylists();
  const follows = usePodcastFollows();

  // What fills the middle of the screen: the cover, the lyrics or the list of what plays next (the bottom buttons toggle them)
  const [view, setView] = useState<'cover' | 'lyrics' | 'queue'>('cover');
  // Lines with real timestamps follow the song; plain lyrics only have the order
  const [lyricsSynced, setLyricsSynced] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [syncedLyrics, setSyncedLyrics] = useState<LrcLine[]>([]);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  // Touch gesture state: cover swipe to skip/previous track
  const coverDragStart = useRef<{ x: number; y: number } | null>(null);
  const [coverDragX, setCoverDragX] = useState(0);

  // Touch gesture state: pull down from top to minimize
  const topDragStart = useRef<number | null>(null);
  const [pullDownY, setPullDownY] = useState(0);

  const handleSelectArtist = (artistName: string) => {
    setIsActionSheetOpen(false);
    toggleExpanded(false);
    onNavigateToArtist?.(artistName);
  };

  const handleSelectAlbum = (albumTitle: string, artistName: string, coverUrl?: string) => {
    setIsActionSheetOpen(false);
    toggleExpanded(false);
    onNavigateToAlbum?.(albumTitle, artistName, coverUrl);
  };

  React.useEffect(() => {
    if (!currentTrack) return;
    if (isLiveTrack(currentTrack) || isPodcastTrack(currentTrack)) {
      setSyncedLyrics([]);
      setLyricsSynced(false);
      return;
    }
    let isMounted = true;
    setSyncedLyrics([]);
    setLyricsSynced(false);

    fetchSyncedLyrics(currentTrack.artist, currentTrack.title).then((res) => {
      if (isMounted) {
        if (res.syncedLines.length > 0) {
          setSyncedLyrics(res.syncedLines);
          setLyricsSynced(true);
        } else if (res.plainLyrics.length > 0) {
          setSyncedLyrics(res.plainLyrics.map((text, idx) => ({ time: idx * 5, text })));
        } else if (currentTrack.lyrics && currentTrack.lyrics.length > 0) {
          setSyncedLyrics(currentTrack.lyrics.map((text, idx) => ({ time: idx * 5, text })));
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentTrack]);

  const coverColor = useCoverColor(isExpanded ? currentTrack?.coverUrl : undefined);

  if (!isExpanded || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  // A radio (live broadcast or endless station mix) has no timeline, shuffle, repeat or way back
  const isRadio = isLive || Boolean(radioStation);
  // One button for "keep this song": it is a favorite and/or in some playlist
  const saved = liked || playlists.some((playlist) => playlist.tracks.some((track) => track.id === currentTrack.id));
  const isPodcast = isPodcastTrack(currentTrack);
  const hasLyrics = !isLive && !isPodcast && syncedLyrics.length > 0;
  // The menu holds what only matters now and then: versions, sleep timer, etc.
  const hasMenu = true;
  // A track without lyrics falls back to the cover; a live station has no queue to show
  const activeView = view === 'lyrics' && !hasLyrics ? 'cover' : view === 'queue' && isLive ? 'cover' : view;
  const show = currentTrack.podcast
    ? { id: currentTrack.podcast.showId, title: currentTrack.podcast.showTitle, author: currentTrack.podcast.showAuthor ?? currentTrack.artist, coverUrl: currentTrack.podcast.showCoverUrl ?? currentTrack.coverUrl }
    : null;
  const followingShow = show ? follows.isFollowing(show.id) : false;
  // For an episode the button follows the show; for a song it keeps the song
  const saveButton = isPodcast && show ? (
    <button
      onClick={() => follows.toggle(show)}
      aria-label={followingShow ? 'Seguindo o programa: deixar de seguir' : 'Seguir o programa'}
      aria-pressed={followingShow}
      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-75 transition-all ${followingShow ? 'bg-accent text-white' : 'material-ultrathin text-label'}`}
    >
      {followingShow ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
    </button>
  ) : isLive ? (
    <div className="w-11 h-11 shrink-0" aria-hidden="true" />
  ) : (
    <button
      onClick={() => {
        // The first tap keeps the song in the favorites; the sheet that opens shows it and offers the playlists
        if (!liked) toggleLike(currentTrack);
        openAddToPlaylist(currentTrack);
      }}
      aria-label={saved ? 'Salvo: gerenciar favoritos e playlists' : 'Salvar nos favoritos e em playlists'}
      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-75 transition-all ${
        saved ? 'bg-accent text-white' : 'material-ultrathin text-label'
      }`}
    >
      {saved ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
    </button>
  );

  const handleSliderCommit = () => {
    seekTo(scrubTime);
    setIsScrubbing(false);
  };

  const handleCoverTouchStart = (e: React.TouchEvent) => {
    coverDragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleCoverTouchMove = (e: React.TouchEvent) => {
    if (!coverDragStart.current) return;
    const dx = e.touches[0].clientX - coverDragStart.current.x;
    const dy = e.touches[0].clientY - coverDragStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setCoverDragX(Math.max(-75, Math.min(75, dx * 0.4)));
    }
  };

  const handleCoverTouchEnd = (e: React.TouchEvent) => {
    if (!coverDragStart.current) return;
    const dx = e.changedTouches[0].clientX - coverDragStart.current.x;
    const dy = e.changedTouches[0].clientY - coverDragStart.current.y;
    coverDragStart.current = null;
    setCoverDragX(0);

    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && !isLive) {
        triggerHaptic('selection');
        playNext();
      } else if (dx > 0 && !isRadio) {
        triggerHaptic('selection');
        playPrevious();
      }
    }
  };

  const handleTopTouchStart = (e: React.TouchEvent) => {
    topDragStart.current = e.touches[0].clientY;
  };

  const handleTopTouchMove = (e: React.TouchEvent) => {
    if (topDragStart.current === null) return;
    const dy = e.touches[0].clientY - topDragStart.current;
    if (dy > 0) {
      setPullDownY(Math.min(120, dy * 0.6));
    }
  };

  const handleTopTouchEnd = (e: React.TouchEvent) => {
    if (topDragStart.current === null) return;
    const dy = e.changedTouches[0].clientY - topDragStart.current;
    topDragStart.current = null;
    setPullDownY(0);
    if (dy > 70) {
      triggerHaptic('light');
      toggleExpanded(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col theme-dark bg-canvas text-label overflow-hidden animate-in slide-in-from-bottom duration-300 select-none"
      style={{
        paddingTop: 'max(var(--safe-top), 12px)',
        paddingBottom: 'max(var(--safe-bottom), 20px)',
        transform: pullDownY > 0 ? `translateY(${pullDownY}px)` : undefined,
        transition: pullDownY > 0 ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
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
        <div
          onTouchStart={handleTopTouchStart}
          onTouchMove={handleTopTouchMove}
          onTouchEnd={handleTopTouchEnd}
          className="flex items-center justify-between pt-1 cursor-grab"
        >
          <button
            onClick={() => {
              triggerHaptic('light');
              toggleExpanded(false);
            }}
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

          {hasMenu ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Mais opções"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="w-10 h-10 rounded-full material-ultrathin flex items-center justify-center text-label active:scale-90 transition-all"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <div role="menu" aria-label="Mais opções" className="absolute right-0 top-12 z-30 w-60 overflow-hidden rounded-sheet material-thick py-1 shadow-2xl animate-in fade-in">
                    {versionCount > 1 && (
                      <MenuItem icon={<Replace className="h-4 w-4 text-label-secondary" aria-hidden="true" />} label="Tocar outra versão" onSelect={() => { setMenuOpen(false); switchVersion(); }} />
                    )}
                    {versionCount > 0 && !isLive && (
                      <MenuItem icon={<SearchX className="h-4 w-4 text-label-secondary" aria-hidden="true" />} label="Não é esta música" onSelect={() => { setMenuOpen(false); markWrongVersion(); }} />
                    )}
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-label-secondary uppercase tracking-wider border-t border-white/10 mt-1">
                      Temporizador de Sono {sleepTimerMinutes ? `(${Math.floor((remainingSleepSeconds ?? 0) / 60)}m)` : ''}
                    </div>
                    {sleepTimerMinutes ? (
                      <MenuItem icon={<Moon className="h-4 w-4 text-accent" aria-hidden="true" />} label="Desativar temporizador" onSelect={() => { setMenuOpen(false); setSleepTimer(null); }} />
                    ) : (
                      <>
                        <MenuItem icon={<Moon className="h-4 w-4 text-label-secondary" aria-hidden="true" />} label="15 minutos" onSelect={() => { setMenuOpen(false); setSleepTimer(15); }} />
                        <MenuItem icon={<Moon className="h-4 w-4 text-label-secondary" aria-hidden="true" />} label="30 minutos" onSelect={() => { setMenuOpen(false); setSleepTimer(30); }} />
                        <MenuItem icon={<Moon className="h-4 w-4 text-label-secondary" aria-hidden="true" />} label="45 minutos" onSelect={() => { setMenuOpen(false); setSleepTimer(45); }} />
                        <MenuItem icon={<Moon className="h-4 w-4 text-label-secondary" aria-hidden="true" />} label="60 minutos" onSelect={() => { setMenuOpen(false); setSleepTimer(60); }} />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 shrink-0" aria-hidden="true" />
          )}
        </div>

        {/* 2. Cover with Swipe Gestures & Dynamic Ambient Aura */}
        {activeView === 'cover' && (
        <div
          onTouchStart={handleCoverTouchStart}
          onTouchMove={handleCoverTouchMove}
          onTouchEnd={handleCoverTouchEnd}
          className="flex-1 flex items-center justify-center my-3 max-h-[420px] touch-pan-y"
        >
          <div
            className="relative w-full max-w-[320px] aspect-square mx-auto transition-transform"
            style={{
              transform: coverDragX !== 0 ? `translateX(${coverDragX}px) rotate(${coverDragX * 0.04}deg)` : undefined,
              transition: coverDragX !== 0 ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Atmospheric Ambient Glow behind the cover */}
            <div
              className={`absolute -inset-4 rounded-3xl blur-2xl transition-all duration-700 pointer-events-none ${
                isPlaying ? 'opacity-50 scale-100 ambient-glow-pulse' : 'opacity-15 scale-90'
              }`}
              style={{
                background: `radial-gradient(circle at center, ${coverColor ?? 'rgba(235, 72, 84, 0.45)'} 0%, transparent 75%)`
              }}
              aria-hidden="true"
            />

            {/* The cover shrinks when paused and grows back on play, as in Apple Music */}
            <div
              className={`relative w-full h-full rounded-card overflow-hidden shadow-2xl shadow-black/80 transition-transform duration-500 bg-elevated-2 flex items-center justify-center ring-[0.5px] ring-white/10 ${
                isPlaying ? 'scale-100' : 'scale-[0.86]'
              }`}
            >
              {/* Specular glass reflection at top edge */}
              <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/[0.14] to-transparent pointer-events-none z-10" />

              <RemoteImage
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
        </div>
        )}

        {/* 2b. Lyrics or the queue: the cover shrinks to a header with the song and the save button */}
        {activeView !== 'cover' && (
          <>
            <div className="flex items-center gap-3 my-3">
              <RemoteImage
                src={currentTrack.coverUrl}
                alt={`Capa do álbum ${currentTrack.album}`}
                referrerPolicy="no-referrer"
                className="h-14 w-14 shrink-0 rounded-lg object-cover bg-elevated-2"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.visibility = 'hidden';
                }}
              />
              <div className="min-w-0 flex-1 text-left">
                <h2 className="truncate text-[17px] font-semibold text-label">{currentTrack.title}</h2>
                <button
                  type="button"
                  onClick={() => setIsActionSheetOpen(true)}
                  className="truncate text-[15px] text-label-secondary hover:text-label text-left active:opacity-60 transition-opacity block max-w-full"
                  aria-label={`Opções do artista ${currentTrack.artist}`}
                >
                  {currentTrack.artist}
                </button>
              </div>
              {saveButton}
            </div>
            <div className="relative min-h-0 flex-1">
              {activeView === 'lyrics' ? (
                <SyncedLyrics lines={syncedLyrics} synced={lyricsSynced} onSeek={seekTo} />
              ) : (
                <QueueList />
              )}
            </div>
          </>
        )}

        <PlaybackNotice className="mb-2" />

        {/* 3. Metadata row with the save button */}
        {activeView === 'cover' && (
        <div className="flex items-center justify-between my-2">
          <div className="min-w-0 pr-3 text-left">
            <h2 className="text-[22px] font-bold text-label truncate tracking-tight">
              {currentTrack.title}
            </h2>
            <button
              type="button"
              onClick={() => setIsActionSheetOpen(true)}
              className="text-[20px] text-label-secondary hover:text-label truncate text-left active:opacity-60 transition-opacity block max-w-full"
              aria-label={`Opções do artista ${currentTrack.artist}`}
            >
              {currentTrack.artist}
            </button>
          </div>

          {saveButton}
        </div>
        )}

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
          <PlaybackProgress
            isScrubbing={isScrubbing}
            scrubTime={scrubTime}
            onScrubStart={() => setIsScrubbing(true)}
            onScrubChange={setScrubTime}
            onScrubCommit={handleSliderCommit}
          />
        </div>
        )}

        {/* 5. Controls of a podcast episode: the episode before, 15 s back, play, 30 s ahead, the next episode */}
        {isPodcast && (
          <div className="flex items-center justify-between px-1 my-2">
            <button onClick={playPrevious} aria-label="Episódio anterior" className="w-11 h-11 flex items-center justify-center text-label active:scale-90 transition-all">
              <SkipBack className="w-7 h-7 fill-current" />
            </button>
            <button onClick={() => skipBy(-15)} aria-label="Voltar 15 segundos" className="relative w-14 h-14 flex items-center justify-center text-label active:scale-90 transition-all">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></svg>
              <span className="absolute mt-[3px] text-[12px] font-bold" aria-hidden="true">15</span>
            </button>
            <button
              onClick={togglePlayPause}
              aria-label={playbackLabel(playback, { pause: 'Pausar reprodução', play: 'Iniciar reprodução', loading: 'Carregando reprodução' })}
              aria-busy={playback === 'loading'}
              className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
            >
              <PlaybackIcon state={playback} className="w-11 h-11" playOffset="ml-1" />
            </button>
            <button onClick={() => skipBy(30)} aria-label="Avançar 30 segundos" className="relative w-14 h-14 flex items-center justify-center text-label active:scale-90 transition-all">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v4h-4" /></svg>
              <span className="absolute mt-[3px] text-[12px] font-bold" aria-hidden="true">30</span>
            </button>
            <button onClick={playNext} aria-label="Próximo episódio" disabled={currentIndex >= queue.length - 1} className="w-11 h-11 flex items-center justify-center text-label active:scale-90 transition-all disabled:opacity-30">
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
          </div>
        )}

        {/* 5. Centralized Geometric Media Controls */}
        {!isPodcast && (
        <div className="flex items-center justify-between px-2 my-2">
          {/* Shuffle Button */}
          {isRadio ? <div className="w-11 h-11" aria-hidden="true" /> : (
          <button
            onClick={() => {
              triggerHaptic('selection');
              toggleShuffle();
            }}
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
            onClick={() => {
              triggerHaptic('selection');
              playPrevious();
            }}
            aria-label="Faixa anterior"
            className="w-12 h-12 rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
          >
            <SkipBack className="w-8 h-8 fill-current" />
          </button>
          )}

          {/* Prominent Play/Pause Button (68px Circular) */}
          <button
            onClick={() => {
              triggerHaptic('light');
              togglePlayPause();
            }}
            aria-label={playbackLabel(playback, { pause: 'Pausar reprodução', play: 'Iniciar reprodução', loading: 'Carregando reprodução' })}
            aria-busy={playback === 'loading'}
            className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
          >
            <PlaybackIcon state={playback} className="w-11 h-11" playOffset="ml-1" />
          </button>

          {/* Next Track Button (a live broadcast has no next) */}
          {isLive ? <div className="w-12 h-12" aria-hidden="true" /> : (
          <button
            onClick={() => {
              triggerHaptic('selection');
              playNext();
            }}
            aria-label="Próxima faixa"
            className="w-12 h-12 rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
          >
            <SkipForward className="w-8 h-8 fill-current" />
          </button>
          )}

          {/* Repeat Button */}
          {isRadio ? <div className="w-11 h-11" aria-hidden="true" /> : (
          <button
            onClick={() => {
              triggerHaptic('selection');
              toggleRepeat();
            }}
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
        )}

        {/* 6. Bottom buttons, as in Apple Music: lyrics on the left (only when there are some), the queue on the right */}
        <div className="mt-3 flex h-11 items-center justify-between px-2">
          {isPodcast ? (
            <button onClick={cycleSpeed} aria-label={`Velocidade de reprodução, ${speedLabel(playbackSpeed)}`} className="flex h-9 min-w-14 items-center justify-center rounded-full bg-white/15 px-3 text-[14px] font-bold tabular-nums text-label active:scale-95">
              {speedLabel(playbackSpeed)}
            </button>
          ) : hasLyrics ? (
            <button
              onClick={() => {
                triggerHaptic('selection');
                setView(activeView === 'lyrics' ? 'cover' : 'lyrics');
              }}
              aria-label="Letra"
              aria-pressed={activeView === 'lyrics'}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors active:scale-90 ${
                activeView === 'lyrics' ? 'bg-white/25 text-label' : 'text-label-secondary'
              }`}
            >
              <MessageSquareQuote className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-11 w-11" aria-hidden="true" />
          )}
          {!isLive ? (
            <button
              onClick={() => {
                triggerHaptic('selection');
                setView(activeView === 'queue' ? 'cover' : 'queue');
              }}
              aria-label="Fila de reprodução"
              aria-pressed={activeView === 'queue'}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors active:scale-90 ${
                activeView === 'queue' ? 'bg-white/25 text-label' : 'text-label-secondary'
              }`}
            >
              <ListMusic className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-11 w-11" aria-hidden="true" />
          )}
        </div>
      </div>

      {currentTrack && (
        <ArtistAlbumActionSheet
          track={currentTrack}
          isOpen={isActionSheetOpen}
          onClose={() => setIsActionSheetOpen(false)}
          onSelectArtist={handleSelectArtist}
          onSelectAlbum={handleSelectAlbum}
        />
      )}
    </div>
  );
};
