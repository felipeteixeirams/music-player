import React, { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, Mail, Music2 } from 'lucide-react';
import { SmokeyBackground } from './SmokeyBackground';
import { confirmCode, requestCode } from '../utils/authClient';
import { CODE_TTL_MS, codeTimers, formatCountdown, lastSentAt, normalizeEmail, RESEND_COOLDOWN_MS, rememberSent } from '../utils/loginCode';

interface FloatingFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
}

/** A filled field whose label sits inside it and floats up once there is something to say. */
const FloatingField: React.FC<FloatingFieldProps> = ({ id, label, icon, value, className = '', ...input }) => {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;
  return (
    <div
      className={`relative rounded-card border bg-fill-tertiary transition-colors ${focused ? 'border-accent' : 'border-separator'}`}
    >
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-4 flex items-center gap-1.5 text-label-secondary transition-all duration-200 ${
          floated ? 'top-2 text-[12px]' : 'top-[17px] text-[17px]'
        }`}
      >
        {icon}
        {label}
      </label>
      <input
        id={id}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`block w-full bg-transparent px-4 pb-2 pt-6 text-[17px] text-label outline-none ${className}`}
        {...input}
      />
    </div>
  );
};

const buttonClass =
  'group w-full rounded-card bg-accent py-3.5 text-[17px] font-semibold text-white transition active:scale-[0.98] active:bg-accent-pressed disabled:opacity-50 flex items-center justify-center gap-2';

/** Re-renders every second while `active`, to drive the countdowns. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Sign-in by invitation: the e-mail receives a code that is typed here, so it also works inside the installed app.
 * The code expires (CODE_TTL_MS) and another can be asked for only after RESEND_COOLDOWN_MS; the server enforces both
 * limits per address and per network, this screen just shows them (and remembers them across reloads).
 */
export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(step === 'code');
  const timers = sentAt === null ? null : codeTimers(sentAt, now);
  const expired = timers !== null && timers.codeLeftMs === 0;

  const markSent = (at: number) => {
    setSentAt(at);
    rememberSent(localStorage, email, at);
    setCode('');
    setStep('code');
  };

  /** Asks for a code, unless one was sent so recently that it is still valid. */
  const sendCode = async (resend: boolean) => {
    setError(null);
    const previous = lastSentAt(localStorage, email);
    if (!resend && previous !== null && codeTimers(previous, Date.now()).codeLeftMs > 0) {
      setSentAt(previous);
      setCode('');
      setStep('code');
      return;
    }
    if (previous !== null && codeTimers(previous, Date.now()).resendLeftMs > 0) {
      setError(`Aguarde ${formatCountdown(codeTimers(previous, Date.now()).resendLeftMs)} para pedir outro código.`);
      return;
    }
    setBusy(true);
    const { error: failure, waitSeconds } = await requestCode(normalizeEmail(email));
    setBusy(false);
    if (waitSeconds) {
      // Someone (or another tab) asked just before: count the wait from the server's answer
      rememberSent(localStorage, email, Date.now() + waitSeconds * 1000 - RESEND_COOLDOWN_MS);
    }
    if (failure) setError(failure);
    else markSent(Date.now());
  };

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    void sendCode(false);
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await confirmCode(normalizeEmail(email), code.trim());
    // On success the auth listener swaps this screen for the app
    if (failure) {
      setBusy(false);
      setError(failure);
    }
  };

  const submitting = busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;

  // Always dark (`theme-dark`), whatever the browser's scheme: the glow needs a black ground
  return (
    <main className="theme-dark relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-5 pb-[var(--safe-bottom)] pt-[var(--safe-top)] text-label">
      <SmokeyBackground />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas/30 via-transparent to-canvas/70" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm space-y-7 rounded-sheet border border-separator material-thick p-7 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-accent shadow-lg shadow-accent/30">
            <Music2 className="h-8 w-8 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight">AuraStream</h1>
          <p className="text-[15px] text-label-secondary">
            {step === 'email' ? 'Acesso por convite. Entre com o e-mail que recebeu o convite.' : `Se ${email.trim()} tiver convite, o código chega em instantes.`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={submitEmail} className="space-y-4">
            <FloatingField
              id="login-email"
              label="E-mail"
              icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={busy || !email.trim()} className={buttonClass}>
              {submitting}
              Receber código
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4">
            <FloatingField
              id="login-code"
              label="Código"
              icon={<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              className="tracking-[0.3em]"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <p className={`text-center text-[13px] ${expired ? 'text-accent' : 'text-label-secondary'}`} role="status" data-testid="code-status">
              {expired ? 'Código expirado. Peça um novo.' : `O código vale por ${formatCountdown(timers?.codeLeftMs ?? CODE_TTL_MS)}`}
            </p>
            <button type="submit" disabled={busy || expired || code.length < 6} className={buttonClass}>
              {submitting}
              Entrar
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={busy || (timers?.resendLeftMs ?? 0) > 0}
              onClick={() => void sendCode(true)}
              className="w-full py-2 text-[15px] text-accent transition-opacity disabled:text-label-secondary disabled:opacity-70"
            >
              {(timers?.resendLeftMs ?? 0) > 0 ? `Reenviar código em ${formatCountdown(timers!.resendLeftMs)}` : 'Reenviar código'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="w-full py-1 text-[15px] text-label-secondary transition-colors hover:text-label"
            >
              Usar outro e-mail
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-center text-[15px] text-accent">
            {error}
          </p>
        )}
      </div>
    </main>
  );
};
