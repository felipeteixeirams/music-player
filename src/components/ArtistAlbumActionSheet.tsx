import React, { useEffect, useState } from 'react';
import { ChevronRight, Disc, User } from 'lucide-react';
import type { Track } from '../types/music';
import { RemoteImage } from './RemoteImage';
import { fetchArtistSearch } from '../utils/catalogClient';

interface ArtistAlbumActionSheetProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onSelectArtist: (artistName: string) => void;
  onSelectAlbum: (albumTitle: string, artistName: string, coverUrl?: string) => void;
}

/**
 * iOS / Apple Music styled bottom sheet menu showing shortcuts
 * to the artist's page and the album's page.
 */
export const ArtistAlbumActionSheet: React.FC<ArtistAlbumActionSheetProps> = ({
  track,
  isOpen,
  onClose,
  onSelectArtist,
  onSelectAlbum
}) => {
  const [artistPictureUrl, setArtistPictureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !track.artist) return;
    let isCurrent = true;
    setArtistPictureUrl(null);

    fetchArtistSearch(track.artist)
      .then((artists) => {
        if (isCurrent && artists[0]?.pictureUrl) {
          setArtistPictureUrl(artists[0].pictureUrl);
        }
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [isOpen, track.artist]);

  if (!isOpen) return null;

  const hasAlbum = Boolean(track.album && track.album.trim() && track.album.toLowerCase() !== 'single');

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Opções da faixa"
    >
      <div
        className="w-full max-w-lg mx-auto bg-elevated-1 border-t border-separator/40 rounded-t-[28px] p-4 pt-2.5 pb-[max(1.25rem,var(--safe-bottom))] shadow-2xl flex flex-col gap-3 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="w-10 h-1 rounded-full bg-label-tertiary mx-auto my-1 opacity-60" aria-hidden="true" />

        {/* Action Rows Container */}
        <div className="rounded-2xl bg-fill-tertiary overflow-hidden divide-y divide-separator/40">
          {/* 1. Artist Shortcut */}
          <button
            onClick={() => {
              onClose();
              onSelectArtist(track.artist);
            }}
            className="w-full flex items-center justify-between p-3.5 hover:bg-fill-secondary active:bg-fill-secondary transition-colors text-left group"
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-elevated-2 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/10">
                {artistPictureUrl ? (
                  <RemoteImage
                    src={artistPictureUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-label-secondary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-label truncate group-hover:text-accent transition-colors">
                  {track.artist}
                </p>
                <p className="text-[13px] text-label-secondary font-medium">
                  Ver artista
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-label-tertiary group-hover:text-label transition-colors shrink-0" />
          </button>

          {/* 2. Album Shortcut */}
          {hasAlbum && (
            <button
              onClick={() => {
                onClose();
                onSelectAlbum(track.album, track.artist, track.coverUrl);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-fill-secondary active:bg-fill-secondary transition-colors text-left group"
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-elevated-2 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/10">
                  {track.coverUrl ? (
                    <RemoteImage
                      src={track.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Disc className="w-5 h-5 text-label-secondary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold text-label truncate group-hover:text-accent transition-colors">
                    {track.album}
                  </p>
                  <p className="text-[13px] text-label-secondary font-medium">
                    Ver álbum
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-label-tertiary group-hover:text-label transition-colors shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
