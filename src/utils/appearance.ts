/**
 * Appearance of the app (Ajustes > Aparência). It is a choice of the device, not of the account, so it lives in plain
 * `localStorage`. "Automático" follows the system, but only in the browser: the installed app on iOS has a status bar
 * fixed to white text, so there the automatic choice stays dark (the old rule). An explicit "Claro" is honoured in the
 * installed app too; its status strip is then painted black (`.status-strip` in `index.css`) to keep the clock legible.
 */

export type Appearance = 'auto' | 'light' | 'dark';

export const APPEARANCE_KEY = 'aurastream_appearance';
export const APPEARANCES: Appearance[] = ['auto', 'light', 'dark'];

export const parseAppearance = (value: unknown): Appearance => (value === 'light' || value === 'dark' ? value : 'auto');

/** Whether the light palette applies for a choice, given what the system and the display mode say. */
export const isLightScheme = (appearance: Appearance, systemLight: boolean, standalone: boolean): boolean =>
  appearance === 'light' || (appearance === 'auto' && systemLight && !standalone);

export function readAppearance(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(APPEARANCE_KEY));
  } catch {
    return 'auto';
  }
}

const THEME_COLORS = { light: '#ffffff', dark: '#000000' };

/** Sets the scheme on the page: the `scheme-light` class on <html> and the browser's own bar color. */
export function applyAppearance(appearance: Appearance): void {
  if (typeof document === 'undefined') return;
  const systemLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const light = isLightScheme(appearance, systemLight, standalone);
  document.documentElement.classList.toggle('scheme-light', light);
  document.documentElement.dataset.appearance = appearance;
  // One color for every tab: the media-query variants in index.html would still follow the system
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = light ? THEME_COLORS.light : THEME_COLORS.dark;
  document.head.appendChild(meta);
}

export function saveAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch {
    /* private mode: the choice lasts until the page closes */
  }
  applyAppearance(appearance);
}

/** Applies the saved choice and follows the system while it is "Automático". Returns the cleanup. */
export function startAppearance(): () => void {
  applyAppearance(readAppearance());
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const onChange = () => applyAppearance(readAppearance());
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
