import React, { useState } from 'react';
import { Loader2, Music2 } from 'lucide-react';
import { confirmCode, requestCode } from '../utils/authClient';

const inputClass =
  'w-full rounded-card bg-fill-tertiary px-4 py-3 text-[17px] text-label placeholder:text-label-tertiary outline-none focus:ring-2 focus:ring-accent';
const buttonClass =
  'w-full rounded-card bg-accent py-3 text-[17px] font-semibold text-white active:bg-accent-pressed disabled:opacity-50 flex items-center justify-center gap-2';

/** Sign-in by invitation: the e-mail receives a code that is typed here, so it also works inside the installed app. */
export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await requestCode(email.trim());
    setBusy(false);
    if (failure) setError(failure);
    else setStep('code');
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await confirmCode(email.trim(), code.trim());
    // On success the auth listener swaps this screen for the app
    if (failure) {
      setBusy(false);
      setError(failure);
    }
  };

  return (
    <main className="min-h-screen bg-canvas text-label flex flex-col items-center justify-center px-8 pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-accent">
            <Music2 className="h-8 w-8 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-[28px] font-bold">AuraStream</h1>
          <p className="text-[15px] text-label-secondary">
            {step === 'email' ? 'Acesso por convite. Entre com o e-mail que recebeu o convite.' : `Enviamos um código para ${email.trim()}.`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={submitEmail} className="space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              aria-label="E-mail"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={busy || !email.trim()} className={buttonClass}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Receber código
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              aria-label="Código"
              placeholder="Código"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${inputClass} text-center tracking-[0.3em]`}
            />
            <button type="submit" disabled={busy || code.length < 6} className={buttonClass}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="w-full py-2 text-[15px] text-accent"
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
