import React from 'react';
import { reportClientError } from '../utils/errorReporter';
import { sessionId } from '../utils/trace';

interface State {
  failed: boolean;
}

/**
 * Without this, an error while drawing a screen leaves the app blank (black): React drops the whole tree. It now
 * shows what happened, reports the error to the server's log, and gives a way out.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    void reportClientError('react', error, info.componentStack?.trim().split('\n')[0]?.trim());
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="theme-dark flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center text-label">
        <h1 className="text-[22px] font-bold">Algo deu errado</h1>
        <p className="max-w-xs text-[15px] text-label-secondary">O erro foi registrado. Recarregue o app; se continuar, avise quem te convidou e informe o código abaixo.</p>
        <button onClick={() => window.location.reload()} className="rounded-card bg-accent px-6 py-3 text-[17px] font-semibold text-white active:scale-[0.98]">
          Recarregar
        </button>
        <p className="text-[13px] text-label-tertiary" data-testid="session-code">Código: {sessionId}</p>
      </main>
    );
  }
}
