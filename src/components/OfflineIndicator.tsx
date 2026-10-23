import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-4 right-4 z-50 max-w-sm mx-auto flex items-center justify-between gap-2 rounded-2xl bg-amber-500/90 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-white shadow-xl animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>Modo Offline — Reproduzindo via cache local</span>
      </div>
      <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
    </div>
  );
};
