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

/**
 * The theme: the app's own look, or one of the two classic ones. The appearance (light, dark, automatic) only applies
 * to the standard theme; the classic themes have palettes of their own (`data-theme` blocks in `index.css`).
 */
export type Theme = 'padrao' | 'azul' | 'ferro';

export const THEME_KEY = 'aurastream_theme';
export const THEMES: Theme[] = ['padrao', 'azul', 'ferro'];
export const THEME_LABELS: Record<Theme, string> = { padrao: 'Padrão', azul: 'Clássico Azul', ferro: 'Clássico Ferro' };

export const parseTheme = (value: unknown): Theme => (value === 'azul' || value === 'ferro' ? value : 'padrao');

/** Whether the light palette applies for a theme and an appearance. The blue classic is a light theme; the iron one is dark. */
export const themeIsLight = (theme: Theme, appearance: Appearance, systemLight: boolean, standalone: boolean): boolean => {
  if (theme === 'azul') return true;
  if (theme === 'ferro') return false;
  return isLightScheme(appearance, systemLight, standalone);
};

/**
 * The pixel face of the Ferro theme, from Google Fonts. Loaded only when that theme is chosen, so nobody else
 * downloads it. Null for the themes that use the system faces.
 */
export const themeFontUrl = (theme: Theme): string | null =>
  theme === 'ferro' ? 'https://fonts.googleapis.com/css2?family=VT323&display=swap' : null;

export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return 'padrao';
  }
}

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

const THEME_COLORS: Record<Theme, { light: string; dark: string }> = {
  padrao: { light: '#ffffff', dark: '#000000' },
  azul: { light: '#eef3fa', dark: '#eef3fa' },
  ferro: { light: '#15181c', dark: '#15181c' }
};

/** Adds the theme's stylesheet once, when the theme needs one. */
function ensureThemeFont(theme: Theme): void {
  const url = themeFontUrl(theme);
  if (!url || document.getElementById('theme-font')) return;
  const link = document.createElement('link');
  link.id = 'theme-font';
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

/** Sets the scheme on the page: the `scheme-light` class on <html> and the browser's own bar color. */
export function applyAppearance(appearance: Appearance, theme: Theme = readTheme()): void {
  if (typeof document === 'undefined') return;
  const systemLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const light = themeIsLight(theme, appearance, systemLight, standalone);
  document.documentElement.classList.toggle('scheme-light', light);
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.dataset.theme = theme;
  ensureThemeFont(theme);
  // One color for every tab: the media-query variants in index.html would still follow the system
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = THEME_COLORS[theme][light ? 'light' : 'dark'];
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

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the choice lasts until the page closes */
  }
  applyAppearance(readAppearance(), theme);
}

/** Applies the saved choice and follows the system while it is "Automático". Returns the cleanup. */
export function startAppearance(): () => void {
  applyAppearance(readAppearance(), readTheme());
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const onChange = () => applyAppearance(readAppearance(), readTheme());
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
