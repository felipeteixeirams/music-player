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
