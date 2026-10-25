import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppUpdate } from '../hooks/useAppUpdate';

/** Offers the new version without reloading by itself, so music never stops mid-track. */
export const UpdateBanner: React.FC = () => {
  const updateAvailable = useAppUpdate();
  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(11rem+var(--safe-bottom))] left-4 right-4 z-50 max-w-sm mx-auto flex items-center justify-between gap-3 rounded-card material-regular px-3.5 py-2 text-[13px] text-label shadow-xl"
    >
      <span>Nova versão disponível</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-semibold text-white active:scale-95"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Atualizar
      </button>
    </div>
  );
};
