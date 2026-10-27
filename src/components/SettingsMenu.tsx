import React, { useEffect, useState } from 'react';
import { Database, Disc3, LogOut, X } from 'lucide-react';
import { fetchDailyUsage, type DailyUsage } from '../utils/usageClient';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { PlaybackDiagnostics } from './PlaybackDiagnostics';
import { APPEARANCES, readAppearance, saveAppearance, type Appearance } from '../utils/appearance';

const APPEARANCE_LABELS: Record<Appearance, string> = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCacheSettings: () => void;
}

/** What used to crowd the header: local storage and installing the app. */
export const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, onOpenCacheSettings }) => {
  const { enabled, email, signOut } = useAuth();
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);

  useEffect(() => {
    if (!isOpen || !enabled) return;
    const controller = new AbortController();
    void fetchDailyUsage(controller.signal).then((value) => {
      if (!controller.signal.aborted) setUsage(value);
    });
    return () => controller.abort();
  }, [isOpen, enabled]);

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

        <div className="rounded-card bg-fill-tertiary px-3 py-2.5">
          <p className="mb-2 text-[15px] text-label">Aparência</p>
          <div role="radiogroup" aria-label="Aparência" className="flex rounded-lg bg-fill-tertiary p-0.5">
            {APPEARANCES.map((value) => (
              <button
                key={value}
                role="radio"
                aria-checked={appearance === value}
                onClick={() => {
                  setAppearance(value);
                  saveAppearance(value);
                }}
                className={`flex-1 rounded-md py-1 text-[13px] transition-colors ${
                  appearance === value ? 'bg-segment font-semibold text-label shadow-sm' : 'text-label-secondary'
                }`}
              >
                {APPEARANCE_LABELS[value]}
              </button>
            ))}
          </div>
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

        {usage && (
          <div className="flex items-center gap-3 rounded-card bg-fill-tertiary px-3 py-2.5 text-[15px] text-label" data-testid="daily-usage">
            <Disc3 className="h-4 w-4 text-accent" aria-hidden="true" />
            <span>
              Faixas novas hoje: {usage.used} de {usage.limit}
            </span>
          </div>
        )}

        {enabled && (
          <div className="rounded-card bg-fill-tertiary px-3 py-2.5 text-[15px]">
            {email && <p className="truncate text-label-secondary" data-testid="account-email">{email}</p>}
            <button
              onClick={() => {
                onClose();
                void signOut();
              }}
              className="mt-1 flex items-center gap-2 text-accent"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        )}

        <PlaybackDiagnostics />

        <div className="flex justify-start">
          <PWAInstallButton />
        </div>
      </div>
    </div>
  );
};
