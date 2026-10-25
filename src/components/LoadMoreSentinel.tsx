import React, { useEffect, useRef } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface LoadMoreSentinelProps {
  /** Items listed so far: when it changes the observer is set up again, so a sentinel that is still on screen loads the next page. */
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

/** End of a paginated list: loads the next page as it nears the viewport, with a button for retry and keyboard use. */
export const LoadMoreSentinel: React.FC<LoadMoreSentinelProps> = ({
  loadedCount,
  hasMore,
  isLoadingMore,
  error,
  onLoadMore,
  onRetry
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasMore || isLoadingMore || error || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadedCount, hasMore, isLoadingMore, error, onLoadMore]);

  if (!hasMore && !error) return null;

  return (
    <div ref={ref} className="py-4 flex flex-col items-center gap-2 text-xs text-white/50" data-testid="load-more">
      {isLoadingMore && (
        <span className="flex items-center gap-2" role="status">
          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
          Carregando mais faixas...
        </span>
      )}
      {error && (
        <div className="flex flex-col items-center gap-2 text-rose-300" role="alert">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {error}
          </span>
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium active:scale-95"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {!isLoadingMore && !error && (
        <button
          onClick={onLoadMore}
          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-medium active:scale-95"
        >
          Carregar mais
        </button>
      )}
    </div>
  );
};
