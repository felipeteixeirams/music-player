import React, { useState } from 'react';
import { Check, Loader2, MessageSquareText } from 'lucide-react';
import { getSession } from '../utils/authClient';
import { readSupabaseConfig } from '../utils/supabaseConfig';
import { FEEDBACK_KINDS, FEEDBACK_LABELS, FEEDBACK_MAX_CHARS, sendFeedback, type FeedbackKind } from '../utils/feedbackRemote';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/** The person writes what works badly or what they would like (INV-FB-01); it goes to the account's feedback table. */
export const FeedbackSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [problem, setProblem] = useState('');

  const canSend = message.trim().length > 0 && status !== 'sending';

  const send = async () => {
    const config = readSupabaseConfig();
    setStatus('sending');
    setProblem('');
    try {
      const session = await getSession();
      if (!config || !session) throw new Error('Entre na sua conta para enviar.');
      await sendFeedback(config, { id: session.user.id, token: session.access_token }, { kind, message, version: __APP_VERSION__ });
      setStatus('sent');
    } catch (error) {
      setStatus('error');
      setProblem(error instanceof Error && error.message.startsWith('Entre') ? error.message : 'Não foi possível enviar agora. Tente de novo em instantes.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 animate-in fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Enviar feedback"
        className="absolute bottom-0 inset-x-0 mx-auto max-w-xl rounded-t-sheet px-4 pt-4 pb-[calc(var(--safe-bottom)+1rem)] max-h-[85vh] overflow-y-auto text-left text-label animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 -z-10 rounded-t-sheet material-thick" aria-hidden="true" />

        {status === 'sent' ? (
          <div className="space-y-4 py-6 text-center">
            <Check className="mx-auto h-9 w-9 text-accent" aria-hidden="true" />
            <h2 className="text-[17px] font-semibold">Obrigado!</h2>
            <p className="text-[14px] text-label-secondary">Recebemos o seu feedback e vamos ler com atenção.</p>
            <button onClick={onClose} className="rounded-full bg-fill-tertiary px-5 py-2 text-[15px] font-semibold text-accent">
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-accent" aria-hidden="true" />
              <h2 className="text-[17px] font-semibold">Enviar feedback</h2>
            </div>

            <div role="radiogroup" aria-label="Tipo de feedback" className="grid grid-cols-3 gap-2">
              {FEEDBACK_KINDS.map((option) => (
                <button
                  key={option}
                  role="radio"
                  aria-checked={kind === option}
                  onClick={() => setKind(option)}
                  className={`rounded-card px-2 py-2 text-[13px] font-semibold ${kind === option ? 'bg-accent text-white' : 'bg-fill-tertiary text-label'}`}
                >
                  {FEEDBACK_LABELS[option]}
                </button>
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="sr-only">Mensagem</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, FEEDBACK_MAX_CHARS))}
                rows={5}
                placeholder="Conte o que aconteceu ou o que você gostaria de ver."
                className="w-full resize-none rounded-card bg-fill-tertiary p-3 text-[15px] text-label placeholder:text-label-tertiary focus:outline-none"
              />
              <span className="block text-right text-[12px] text-label-secondary">
                {message.length}/{FEEDBACK_MAX_CHARS}
              </span>
            </label>

            {problem && <p role="alert" className="text-[13px] text-rose-500">{problem}</p>}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="rounded-card bg-fill-tertiary py-2.5 text-[15px] font-semibold text-label">
                Cancelar
              </button>
              <button
                onClick={() => void send()}
                disabled={!canSend}
                className="flex items-center justify-center gap-2 rounded-card bg-accent py-2.5 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {status === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>{status === 'sending' ? 'Enviando' : 'Enviar'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
