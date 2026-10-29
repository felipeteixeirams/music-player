import React, { useEffect, useState } from 'react';
import { ChevronRight, Database, Disc3, LogOut, ShieldCheck } from 'lucide-react';
import { fetchDailyUsage, type DailyUsage } from '../utils/usageClient';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { PlaybackDiagnostics } from './PlaybackDiagnostics';
import { APPEARANCES, readAppearance, saveAppearance, type Appearance } from '../utils/appearance';
import { sessionId } from '../utils/trace';
import { fetchIsAdmin } from '../utils/adminClient';
import { AdminPanel } from './AdminPanel';

const APPEARANCE_LABELS: Record<Appearance, string> = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCacheSettings: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="space-y-1.5">
    <h3 className="px-4 text-[13px] uppercase tracking-wide text-label-secondary">{title}</h3>
    <div className="divide-y divide-separator overflow-hidden rounded-card bg-elevated">{children}</div>
  </section>
);

/** Settings as a full screen of grouped lists, like the music apps: account, appearance, storage, help, about. */
export const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, onOpenCacheSettings }) => {
  const { enabled, email, signOut } = useAuth();
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !enabled) return;
    const controller = new AbortController();
    void fetchDailyUsage(controller.signal).then((value) => {
      if (!controller.signal.aborted) setUsage(value);
    });
    return () => controller.abort();
  }, [isOpen, enabled]);

  // The server decides who is an administrator; this only shows the entry
  useEffect(() => {
    if (!isOpen || !enabled) return;
    const controller = new AbortController();
    void fetchIsAdmin(controller.signal).then((value) => {
      if (!controller.signal.aborted) setIsAdmin(value);
    });
    return () => controller.abort();
  }, [isOpen, enabled]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Ajustes"
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas animate-in fade-in"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto max-w-xl space-y-6 px-4 pb-10 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[34px] font-bold leading-10 text-label">Ajustes</h2>
          <button onClick={onClose} aria-label="Fechar ajustes" className="rounded-full bg-fill-tertiary px-4 py-1.5 text-[15px] font-semibold text-accent">
            OK
          </button>
        </div>

        {enabled && (
          <Section title="Conta">
            <div className="flex items-center gap-3 px-4 py-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[17px] font-semibold text-white">
                {(email ?? '?').charAt(0).toUpperCase()}
              </span>
              <p className="min-w-0 truncate text-[15px] text-label" data-testid="account-email">{email}</p>
            </div>
            <button
              onClick={() => {
                onClose();
                void signOut();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-accent"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sair</span>
            </button>
          </Section>
        )}

        <Section title="Aparência">
          <div className="px-4 py-3">
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
        </Section>

        <Section title="Armazenamento e dados">
          <button
            onClick={() => {
              onClose();
              onOpenCacheSettings();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-label"
          >
            <Database className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="flex-1">Gerenciar cache local</span>
            <ChevronRight className="h-4 w-4 text-label-tertiary" aria-hidden="true" />
          </button>
          {usage && (
            <div className="flex items-center gap-3 px-4 py-3 text-[15px] text-label" data-testid="daily-usage">
              <Disc3 className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>
                Faixas novas hoje: {usage.used} de {usage.limit}
              </span>
            </div>
          )}
        </Section>

        <Section title="Ajuda">
          <PlaybackDiagnostics />
          <div className="flex justify-start px-4 py-3 empty:hidden">
            <PWAInstallButton />
          </div>
        </Section>

        {isAdmin && (
          <Section title="Administração">
            <button onClick={() => setAdminOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-label">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
              <span className="flex-1">Painel de administrador</span>
              <ChevronRight className="h-4 w-4 text-label-tertiary" aria-hidden="true" />
            </button>
          </Section>
        )}

        <Section title="Sobre">
          <div className="flex items-center justify-between px-4 py-3 text-[15px]">
            <span className="text-label">Versão</span>
            <span className="text-label-secondary" data-testid="app-version">{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-[15px]">
            <span className="text-label">Sessão</span>
            <span className="text-label-secondary" data-testid="session-code">{sessionId}</span>
          </div>
        </Section>
      </div>
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </div>
  );
};
