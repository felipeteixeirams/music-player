/**
 * How the contexts and the sync talk without knowing each other: a context announces that it saved something
 * ("changed"), and the sync announces that it replaced what is saved with what the account holds ("applied"),
 * so the contexts read their storage again.
 */
const bus = new EventTarget();

const subscribe = (name: string) => (callback: () => void) => {
  bus.addEventListener(name, callback);
  return () => bus.removeEventListener(name, callback);
};

export const emitUserDataChanged = () => bus.dispatchEvent(new Event('changed'));
export const emitUserDataApplied = () => bus.dispatchEvent(new Event('applied'));
export const onUserDataChanged = subscribe('changed');
export const onUserDataApplied = subscribe('applied');

/** The same two announcements for the play history: a play was recorded (or cleared), and the account's list arrived. */
export const emitHistoryChanged = () => bus.dispatchEvent(new Event('history-changed'));
export const emitHistoryApplied = () => bus.dispatchEvent(new Event('history-applied'));
export const onHistoryChanged = subscribe('history-changed');
export const onHistoryApplied = subscribe('history-applied');
