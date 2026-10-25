import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackPage } from '../types/music';
import { EMPTY_PAGED_LIST, appendPage, fromPage, type PagedListState } from '../utils/pagedList';

type LoadPage = (index: number, signal: AbortSignal) => Promise<TrackPage>;

interface PagedTracks extends PagedListState {
  hasMore: boolean;
  /** First page on its way (nothing to show yet). */
  isLoading: boolean;
  /** A following page on its way. */
  isLoadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  retry: () => void;
}

const messageOf = (err: unknown) => (err instanceof Error && err.message) || 'Não foi possível carregar agora.';

/**
 * A track list loaded page by page. A new `key` (a category, a search) starts a fresh list and cancels
 * whatever was loading for the previous one; `key = null` keeps the list empty and idle. `initialPage`
 * is a first page already in hand, so the list shows it at once and only fetches what follows.
 */
export function usePagedTracks(key: string | null, loadPage: LoadPage, initialPage?: TrackPage): PagedTracks {
  const [list, setList] = useState<PagedListState>(EMPTY_PAGED_LIST);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;

  const controllerRef = useRef<AbortController | null>(null);
  const listRef = useRef(list);
  listRef.current = list;
  const busyRef = useRef(false);

  const fetchPage = useCallback(async (index: number) => {
    const controller = controllerRef.current;
    if (!controller || busyRef.current) return;
    busyRef.current = true;

    setError(null);
    if (index === 0) setIsLoading(true);
    else setIsLoadingMore(true);
    try {
      const page = await loadPageRef.current(index, controller.signal);
      if (controller.signal.aborted) return;
      setList((prev) => appendPage(index === 0 ? EMPTY_PAGED_LIST : prev, page));
    } catch (err) {
      if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
      setError(messageOf(err));
    } finally {
      if (controllerRef.current === controller) {
        busyRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    controllerRef.current?.abort();
    busyRef.current = false;
    setError(null);
    setIsLoading(false);
    setIsLoadingMore(false);

    if (key === null) {
      controllerRef.current = null;
      setList(EMPTY_PAGED_LIST);
      return;
    }

    controllerRef.current = new AbortController();
    const first = initialPageRef.current;
    if (first && first.tracks.length > 0) {
      setList(fromPage(first));
    } else {
      setList(EMPTY_PAGED_LIST);
      void fetchPage(0);
    }
    return () => controllerRef.current?.abort();
  }, [key, fetchPage]);

  const loadMore = useCallback(() => {
    const { nextIndex } = listRef.current;
    if (nextIndex !== null && !busyRef.current) void fetchPage(nextIndex);
  }, [fetchPage]);

  const retry = useCallback(() => {
    void fetchPage(listRef.current.nextIndex ?? 0);
  }, [fetchPage]);

  return { ...list, hasMore: list.nextIndex !== null, isLoading, isLoadingMore, error, loadMore, retry };
}
