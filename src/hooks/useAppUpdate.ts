import { useEffect, useState } from 'react';
import { fetchDeployedVersion, isNewVersionAvailable } from '../utils/appVersion';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** Whether a newer deploy exists than the one this session loaded; checked when the app returns to the foreground. */
export function useAppUpdate(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (__APP_VERSION__ === 'dev') return;
    let cancelled = false;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const deployed = await fetchDeployedVersion();
      if (!cancelled && isNewVersionAvailable(__APP_VERSION__, deployed)) setUpdateAvailable(true);
    };

    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return updateAvailable;
}
