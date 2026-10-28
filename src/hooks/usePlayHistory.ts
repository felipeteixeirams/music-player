import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { distinctRecent, loadHistory, requestClear } from '../utils/playHistory';
import { emitHistoryChanged, onHistoryApplied, onHistoryChanged } from '../utils/userDataEvents';

/** The tracks the user played lately (one row per track, newest first) and a way to clear the history. */
export function usePlayHistory() {
  const { storage } = useAuth();
  const [entries, setEntries] = useState(() => loadHistory(storage));

  useEffect(() => {
    const reload = () => setEntries(loadHistory(storage));
    reload();
    const stopChanged = onHistoryChanged(reload);
    const stopApplied = onHistoryApplied(reload);
    return () => {
      stopChanged();
      stopApplied();
    };
  }, [storage]);

  const recent = useMemo(() => distinctRecent(entries), [entries]);
  const clear = useCallback(() => {
    requestClear(storage);
    setEntries([]);
    emitHistoryChanged();
  }, [storage]);

  return { recent, entries, clear };
}
