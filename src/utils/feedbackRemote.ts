import { createRestCaller, RemoteError, type RestConfig } from './supabaseRest';

export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_MAX_CHARS = 1000;

export const FEEDBACK_LABELS: Record<FeedbackKind, string> = { bug: 'Algo não funciona', idea: 'Sugestão', other: 'Outro' };

export interface FeedbackUser {
  id: string;
  token: string;
}

/**
 * Sends the person's feedback (INV-FB-01) to `app_feedback`, with their own token: the row-level security policy only
 * takes rows for themselves. Throws a RemoteError when the database refuses, so the sheet can say it did not go.
 */
export async function sendFeedback(
  config: RestConfig,
  user: FeedbackUser,
  feedback: { kind: FeedbackKind; message: string; version: string },
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const message = feedback.message.trim().slice(0, FEEDBACK_MAX_CHARS);
  if (!message) throw new RemoteError('Escreva uma mensagem', 400);
  const call = createRestCaller(config, async () => user, fetchImpl);
  await call('/app_feedback', {
    method: 'POST',
    body: JSON.stringify([{ user_id: user.id, kind: feedback.kind, message, version: feedback.version.slice(0, 20) }]),
    prefer: 'return=minimal'
  });
}
