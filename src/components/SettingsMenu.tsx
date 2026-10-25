import React from 'react';
import { Database, X } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCacheSettings: () => void;
}

/** What used to crowd the header: local storage and installing the app. */
export const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, onOpenCacheSettings }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 animate-in fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Ajustes"
        className="absolute right-4 top-[calc(3.75rem+var(--safe-top))] w-64 rounded-sheet p-4 shadow-2xl text-left space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The blur sits on a sibling: a filter on an ancestor would trap the install dialog's fixed positioning */}
        <div className="absolute inset-0 -z-10 rounded-sheet material-thick" aria-hidden="true" />

        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-label">Ajustes</h2>
          <button
            onClick={onClose}
            aria-label="Fechar ajustes"
            className="p-1.5 rounded-full bg-fill-tertiary text-label-secondary hover:text-label"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => {
            onClose();
            onOpenCacheSettings();
          }}
          className="w-full flex items-center gap-3 rounded-card bg-fill-tertiary px-3 py-2.5 text-left text-[15px] text-label active:scale-[0.98] transition-transform"
        >
          <Database className="w-4 h-4 text-accent" aria-hidden="true" />
          <span>Gerenciar cache local</span>
        </button>

        <div className="flex justify-start">
          <PWAInstallButton />
        </div>
      </div>
    </div>
  );
};
