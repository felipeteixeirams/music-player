/**
 * Ids that tie what happens on this device to the server's log (see `api/_trace.ts`): one per app session (a page
 * load) and one per request. The app makes them, so a call that never reached the server is still named here.
 */

function randomId(bytes: number): string {
  const values = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(values);
  else for (let i = 0; i < bytes; i += 1) values[i] = Math.floor(Math.random() * 256);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

/** This app session. Shown on the error screen and in the diagnostic report, so a complaint can be found in the log. */
export const sessionId = randomId(6);

export const newRequestId = (): string => randomId(5);
