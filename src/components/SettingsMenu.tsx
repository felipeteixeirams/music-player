import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, Database, FlaskConical, Gauge, LogOut, ShieldCheck } from 'lucide-react';
import { fetchDailyUsage, type DailyUsage } from '../utils/usageClient';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { PlaybackDiagnostics } from './PlaybackDiagnostics';
import { APPEARANCES, readAppearance, readTheme, saveAppearance, saveTheme, THEMES, THEME_LABELS, type Appearance, type Theme } from '../utils/appearance';
import { sessionId } from '../utils/trace';
import { fetchIsAdmin } from '../utils/adminClient';
import { AdminPanel } from './AdminPanel';
import { BackgroundLab } from './BackgroundLab';

const APPEARANCE_LABELS: Record<Appearance, string> = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };

/** Initial of the account, for the round avatar. */
const initialOf = (email: string | null): string => (email ?? '?').trim().charAt(0).toUpperCase() || '?';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCacheSettings: () => void;
}

const Section: React.FC<{ title: string; footer?: string; children: React.ReactNode }> = ({ title, footer, children }) => (
  <section aria-label={title} className="space-y-1.5">
    <h3 className="px-4 text-[13px] uppercase tracking-wide text-label-secondary">{title}</h3>
    <div className="divide-y divide-separator overflow-hidden rounded-card bg-elevated">{children}</div>
    {footer && <p className="px-4 text-[12px] leading-snug text-label-secondary">{footer}</p>}
  </section>
);

/** A list of choices, one per row, with a check on the chosen one (the iOS pattern for "pick one"). */
function ChoiceRows<T extends string>({
  label,
  options,
  labels,
  value,
  disabled = false,
  onChoose
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  disabled?: boolean;
  onChoose: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={disabled ? 'opacity-40' : ''}>
      {options.map((option) => (
        <button
          key={option}
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          onClick={() => onChoose(option)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-label disabled:cursor-default"
        >
          <span className="flex-1">{labels[option]}</span>
          {value === option && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

/** Settings as a full screen of grouped lists, like the music apps: account, appearance, storage, help, about. */
export const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, onOpenCacheSettings }) => {
  const { enabled, email, signOut } = useAuth();
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [isAdmin, setIsAdmin] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
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
          <section aria-label="Conta" className="overflow-hidden rounded-card bg-elevated">
            <div className="flex items-center gap-3.5 px-4 py-4">
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-[20px] font-semibold text-white">
                {initialOf(email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold text-label" data-testid="account-email">{email}</p>
                <p className="text-[13px] text-label-secondary">Conta AuraStream</p>
              </div>
            </div>
          </section>
        )}

        <Section title="Tema" footer="Os temas clássicos têm cores próprias. A aparência abaixo vale só para o tema Padrão.">
          <ChoiceRows
            label="Tema"
            options={THEMES}
            labels={THEME_LABELS}
            value={theme}
            onChoose={(value) => {
              setTheme(value);
              saveTheme(value);
            }}
          />
        </Section>

        <Section title="Aparência">
          <ChoiceRows
            label="Aparência"
            options={APPEARANCES}
            labels={APPEARANCE_LABELS}
            value={appearance}
            disabled={theme !== 'padrao'}
            onChoose={(value) => {
              setAppearance(value);
              saveAppearance(value);
            }}
          />
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
              <Gauge className="h-4 w-4 text-accent" aria-hidden="true" />
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
            <button onClick={() => setLabOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-label">
              <FlaskConical className="h-4 w-4 text-accent" aria-hidden="true" />
              <span className="flex-1">Laboratório de segundo plano</span>
              <ChevronRight className="h-4 w-4 text-label-tertiary" aria-hidden="true" />
            </button>
          </Section>
        )}

        {enabled && (
          <section aria-label="Sair" className="overflow-hidden rounded-card bg-elevated">
            <button
              onClick={() => {
                onClose();
                void signOut();
              }}
              className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] font-semibold text-accent"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sair</span>
            </button>
          </section>
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
      {labOpen && <BackgroundLab onClose={() => setLabOpen(false)} />}
    </div>
  );
};
