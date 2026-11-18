import React, { useState } from 'react';
import { BarChart3, Clock, Flame, Heart, Music, Play, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { Track } from '../types/music';
import { usePlayStats } from '../hooks/usePlayStats';
import { formatPlayTime } from '../utils/playStats';
import { RemoteImage } from './RemoteImage';
import { useAudio } from '../context/AudioContext';
import { TrackPlaybackIcon } from './PlaybackIcon';
import { triggerHaptic } from '../utils/haptics';

interface StatsViewProps {
  onPlay: (track: Track, queue: Track[]) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ onPlay }) => {
  const stats = usePlayStats();
  const { currentTrack, isPlaying, isLiked, toggleLike } = useAudio();
  const [activeTab, setActiveTab] = useState<'top' | 'artists' | 'timeline'>('top');

  const topQueue = stats.topTracks.map((item) => item.track);

  if (stats.totalPlays === 0) {
    return (
      <div className="px-6 py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-fill-tertiary flex items-center justify-center text-accent">
          <BarChart3 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-label">Nenhuma estatística ainda</h3>
          <p className="text-sm text-label-secondary max-w-xs mx-auto">
            Comece a ouvir músicas no app para desbloquear seu ranking de mais tocadas, artistas favoritos e tempo de audição.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Summary Metric Highlights (Apple Music Bento Cards) */}
      <section aria-label="Resumo de audição" className="px-4 grid grid-cols-2 gap-3 pt-2">
        <div className="p-3.5 rounded-2xl bg-fill-tertiary/70 border border-white/[0.06] flex flex-col justify-between">
          <div className="flex items-center justify-between text-label-secondary mb-1">
            <span className="text-xs font-medium">Reproduções</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <span className="text-2xl font-bold text-label tabular-nums tracking-tight">
              {stats.totalPlays}
            </span>
            <span className="block text-[11px] text-label-tertiary mt-0.5">
              {stats.uniqueTracksCount} músicas diferentes
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-fill-tertiary/70 border border-white/[0.06] flex flex-col justify-between">
          <div className="flex items-center justify-between text-label-secondary mb-1">
            <span className="text-xs font-medium">Tempo Ouvido</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <span className="text-2xl font-bold text-label tabular-nums tracking-tight">
              {stats.totalMinutesListened >= 60
                ? `${Math.floor(stats.totalMinutesListened / 60)}h ${stats.totalMinutesListened % 60}m`
                : `${stats.totalMinutesListened} min`}
            </span>
            <span className="block text-[11px] text-label-tertiary mt-0.5">
              tempo acumulado
            </span>
          </div>
        </div>

        {stats.favoriteArtist && (
          <div className="col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-fill-tertiary/90 to-fill-secondary/50 border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {stats.favoriteArtist.coverUrl ? (
                <RemoteImage
                  src={stats.favoriteArtist.coverUrl}
                  alt={stats.favoriteArtist.artist}
                  className="w-12 h-12 rounded-full object-cover bg-fill-secondary shrink-0 shadow-md ring-1 ring-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wider block">
                  Mais Escutado
                </span>
                <span className="text-[16px] font-bold text-label truncate block leading-snug">
                  {stats.favoriteArtist.artist}
                </span>
                <span className="text-[12px] text-label-secondary tabular-nums">
                  {stats.favoriteArtist.count} {stats.favoriteArtist.count === 1 ? 'reprodução' : 'reproduções'} · {stats.favoriteArtist.trackCount} {stats.favoriteArtist.trackCount === 1 ? 'faixa' : 'faixas'}
                </span>
              </div>
            </div>

            <Sparkles className="w-5 h-5 text-accent shrink-0 opacity-80" />
          </div>
        )}
      </section>

      {/* 2. Primary Play All Top Tracks Action */}
      {topQueue.length > 0 && (
        <div className="px-4">
          <button
            onClick={() => {
              triggerHaptic('medium');
              onPlay(topQueue[0], topQueue);
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-accent text-white font-semibold text-[16px] shadow-lg shadow-accent/25 active:scale-[0.98] transition-all"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Tocar Mix Mais Tocadas ({topQueue.length})</span>
          </button>
        </div>
      )}

      {/* 3. Section Segmented Filter Control */}
      <div className="px-4">
        <div className="flex items-center gap-1 p-1 bg-fill-tertiary rounded-xl text-xs font-semibold">
          <button
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab('top');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'top' ? 'bg-white/15 text-white shadow-xs' : 'text-label-secondary hover:text-label'
            }`}
          >
            Mais Tocadas
          </button>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab('artists');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'artists' ? 'bg-white/15 text-white shadow-xs' : 'text-label-secondary hover:text-label'
            }`}
          >
            Artistas
          </button>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab('timeline');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'timeline' ? 'bg-white/15 text-white shadow-xs' : 'text-label-secondary hover:text-label'
            }`}
          >
            Histórico Detalhado
          </button>
        </div>
      </div>

      {/* 4. Tab Content */}
      <div className="px-4">
        {activeTab === 'top' && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-label-secondary px-1 mb-2">
              Ranking de Reproduções
            </h4>
            <div className="divide-y divide-separator/30">
              {stats.topTracks.map((item, index) => {
                const track = item.track;
                const isThisActive = currentTrack?.id === track.id;
                const isThisPlaying = isThisActive && isPlaying;
                const liked = isLiked(track.id);

                return (
                  <div
                    key={`${track.id}-${index}`}
                    onClick={() => {
                      triggerHaptic('light');
                      onPlay(track, topQueue);
                    }}
                    className="flex items-center justify-between py-2.5 px-2 rounded-xl cursor-pointer hover:bg-fill-tertiary/40 active:bg-fill-tertiary transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      {/* Rank Number */}
                      <span className="w-5 text-center text-[14px] font-bold text-label-secondary tabular-nums shrink-0">
                        {index + 1}
                      </span>

                      {/* Cover with Playing Indicator */}
                      <div className="relative w-11 h-11 shrink-0 rounded-cover overflow-hidden bg-elevated-2">
                        <RemoteImage
                          src={track.coverUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        {isThisPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <TrackPlaybackIcon trackId={track.id} className="w-4 h-4 text-accent" />
                          </div>
                        )}
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0">
                        <span className={`block text-[15px] font-medium truncate ${isThisActive ? 'text-accent' : 'text-label'}`}>
                          {track.title}
                        </span>
                        <span className="block text-[12px] text-label-secondary truncate">
                          {track.artist}
                        </span>
                      </div>
                    </div>

                    {/* Plays count & Like button */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[12px] text-label-secondary font-medium tabular-nums bg-fill-tertiary px-2 py-0.5 rounded-full">
                        {item.count} {item.count === 1 ? 'play' : 'plays'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          toggleLike(track);
                        }}
                        aria-label={liked ? `Descurtir ${track.title}` : `Curtir ${track.title}`}
                        className={`p-1.5 rounded-full transition-all active:scale-90 ${
                          liked ? 'text-accent' : 'text-label-tertiary hover:text-label'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'artists' && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-label-secondary px-1">
              Artistas Mais Ouvidos
            </h4>
            <div className="divide-y divide-separator/30">
              {stats.topArtists.map((artistStat, idx) => (
                <div
                  key={`${artistStat.artist}-${idx}`}
                  className="flex items-center justify-between py-2.5 px-2 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 text-center text-[14px] font-bold text-label-secondary tabular-nums shrink-0">
                      {idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-fill-tertiary shrink-0 shadow-sm">
                      {artistStat.coverUrl ? (
                        <RemoteImage
                          src={artistStat.coverUrl}
                          alt={artistStat.artist}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-label-tertiary">
                          <Users className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[15px] font-medium text-label truncate">
                        {artistStat.artist}
                      </span>
                      <span className="block text-[12px] text-label-secondary">
                        {artistStat.trackCount} {artistStat.trackCount === 1 ? 'faixa tocada' : 'faixas tocadas'}
                      </span>
                    </div>
                  </div>

                  <span className="text-[13px] font-semibold text-accent tabular-nums bg-accent/10 px-2.5 py-0.5 rounded-full">
                    {artistStat.count} {artistStat.count === 1 ? 'play' : 'plays'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-6">
            {stats.timeline.map((group) => (
              <div key={group.period} className="space-y-2">
                <h4 className="text-[13px] font-bold text-label-secondary uppercase tracking-wider px-1">
                  {group.period}
                </h4>
                <div className="divide-y divide-separator/30 bg-fill-tertiary/30 rounded-2xl p-1">
                  {group.entries.map((entry, i) => {
                    const track = entry.track;
                    const isThisActive = currentTrack?.id === track.id;

                    return (
                      <div
                        key={`${track.id}-${entry.playedAt}-${i}`}
                        onClick={() => {
                          triggerHaptic('light');
                          onPlay(track, [track]);
                        }}
                        className="flex items-center justify-between py-2 px-2.5 rounded-xl cursor-pointer hover:bg-fill-tertiary/50 active:bg-fill-tertiary transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="w-10 h-10 shrink-0 rounded-cover overflow-hidden bg-elevated-2">
                            <RemoteImage
                              src={track.coverUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className={`block text-[14px] font-medium truncate ${isThisActive ? 'text-accent' : 'text-label'}`}>
                              {track.title}
                            </span>
                            <span className="block text-[12px] text-label-secondary truncate">
                              {track.artist}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] text-label-tertiary tabular-nums shrink-0">
                          {formatPlayTime(entry.playedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
