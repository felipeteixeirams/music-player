import React, { useRef, useState } from 'react';
import { AlignJustify } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

const MAX_ROWS = 50;

/** What plays after the current track, in the queue's order; a tap plays that track and the handle drags it elsewhere. */
export const QueueList: React.FC = () => {
  const { queue, currentIndex, playTrack, radioStation, moveQueueTrack } = useAudio();
  const first = currentIndex + 1;
  const upcoming = queue.slice(first, first + MAX_ROWS);

  // The row being dragged and how far it moved; the rows between shift to make room, the move is made on release
  const [drag, setDrag] = useState<{ row: number; dy: number } | null>(null);
  const startY = useRef(0);
  const rowHeight = useRef(64);
  const listRef = useRef<HTMLUListElement | null>(null);

  const targetRow = (row: number, dy: number) => Math.max(0, Math.min(upcoming.length - 1, row + Math.round(dy / rowHeight.current)));

  const shiftOf = (row: number): number => {
    if (!drag || row === drag.row) return 0;
    const target = targetRow(drag.row, drag.dy);
    if (drag.row < target && row > drag.row && row <= target) return -rowHeight.current;
    if (drag.row > target && row >= target && row < drag.row) return rowHeight.current;
    return 0;
  };

  return (
    <div role="region" aria-label="Fila de reprodução" className="absolute inset-0 overflow-y-auto text-left no-scrollbar">
      <h3 className="pb-2 text-[17px] font-bold text-label">{radioStation ? `Rádio ${radioStation.name}` : 'Continue tocando'}</h3>
      {upcoming.length === 0 ? (
        <p className="text-[15px] text-label-secondary">Não há mais faixas a seguir.</p>
      ) : (
        <ul ref={listRef}>
          {upcoming.map((track, row) => {
            const dragging = drag?.row === row;
            return (
              <li
                key={`${track.id}-${row}`}
                data-row={row}
                className={`flex items-center ${dragging ? 'relative z-10 rounded-lg bg-white/10 shadow-xl' : 'transition-transform duration-150'}`}
                style={{ transform: `translateY(${dragging ? drag.dy : shiftOf(row)}px)` }}
              >
                <button onClick={() => playTrack(track)} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left active:opacity-60">
                  <img
                    src={track.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 shrink-0 rounded-md bg-elevated-2 object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.visibility = 'hidden';
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] text-label">{track.title}</span>
                    <span className="block truncate text-[14px] text-label-secondary">{track.artist}</span>
                  </span>
                </button>
                <button
                  aria-label={`Reordenar ${track.title}`}
                  title="Arraste para reordenar"
                  className="flex h-12 w-12 shrink-0 touch-none items-center justify-center text-label-secondary"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    startY.current = e.clientY;
                    rowHeight.current = e.currentTarget.closest('li')?.getBoundingClientRect().height || 64;
                    setDrag({ row, dy: 0 });
                  }}
                  onPointerMove={(e) => {
                    if (drag?.row === row) setDrag({ row, dy: e.clientY - startY.current });
                  }}
                  onPointerUp={(e) => {
                    if (drag?.row !== row) return;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    const target = targetRow(row, drag.dy);
                    setDrag(null);
                    if (target !== row) moveQueueTrack(first + row, first + target);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(e) => {
                    // The same move without a finger: the arrows move the track one place
                    if (e.key === 'ArrowUp' && row > 0) {
                      e.preventDefault();
                      moveQueueTrack(first + row, first + row - 1);
                    } else if (e.key === 'ArrowDown' && row < upcoming.length - 1) {
                      e.preventDefault();
                      moveQueueTrack(first + row, first + row + 1);
                    }
                  }}
                >
                  <AlignJustify className="h-5 w-5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
