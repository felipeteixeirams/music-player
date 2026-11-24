/**
 * The app on the iPhone home screen (iOS, `display-mode: standalone`). Only there the viewport loses `viewport-fit=cover`:
 * with it, WebKit paints a white strip under the page and a glass effect over the status bar, which no CSS can cover.
 * The page then starts below the status bar, and the bottom inset is set by `--safe-bottom` (index.css). The browser,
 * Android and desktop installs keep the full-bleed viewport (INV-UI-15).
 */

export interface StandaloneSignals {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  displayStandalone: boolean;
  /** Safari's own flag for a web app opened from the home screen. */
  navigatorStandalone: boolean;
}

/** True only for an iPhone or iPad running the installed app. */
export function isIosStandalone(signals: StandaloneSignals): boolean {
  const ios = /iPhone|iPad|iPod/.test(signals.userAgent) || (signals.platform === 'MacIntel' && signals.maxTouchPoints > 1);
  return ios && (signals.displayStandalone || signals.navigatorStandalone);
}

/** The viewport content without `viewport-fit=cover`; every other directive stays as it is (zoom is still locked). */
export function viewportWithoutCover(content: string): string {
  return content
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '' && !part.startsWith('viewport-fit'))
    .join(', ');
}

/** Form fields: while one has focus the keyboard is up and the bottom inset is the keyboard's, not the home indicator's. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as Partial<Element> | null;
  if (!element || typeof element.matches !== 'function') return false;
  return element.matches('input, textarea, select, [contenteditable="true"]');
}

/**
 * Runs before the first render. On the iPhone home-screen app it drops `viewport-fit=cover` and marks `<html>` with
 * `data-standalone`, and `data-editing` while a field is focused. Anywhere else it changes nothing.
 */
export function startStandalone(doc: Document = document, win: Window = window): void {
  const signals: StandaloneSignals = {
    userAgent: win.navigator.userAgent,
    platform: win.navigator.platform,
    maxTouchPoints: win.navigator.maxTouchPoints,
    displayStandalone: win.matchMedia?.('(display-mode: standalone)').matches ?? false,
    navigatorStandalone: (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  };
  if (!isIosStandalone(signals)) return;

  const html = doc.documentElement;
  html.setAttribute('data-standalone', '');
  const meta = doc.querySelector('meta[name="viewport"]');
  if (meta) meta.setAttribute('content', viewportWithoutCover(meta.getAttribute('content') ?? ''));

  // Focus moves between fields without leaving the keyboard: the mark is removed only when nothing editable has focus
  const settle = () => {
    win.setTimeout(() => {
      if (isEditableTarget(doc.activeElement)) html.setAttribute('data-editing', '');
      else html.removeAttribute('data-editing');
    }, 0);
  };
  doc.addEventListener('focusin', settle);
  doc.addEventListener('focusout', settle);
}
