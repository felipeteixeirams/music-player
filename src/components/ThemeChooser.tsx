import React from 'react';
import { Check } from 'lucide-react';
import { APPEARANCES, THEMES, THEME_LABELS, type Appearance, type Theme } from '../utils/appearance';

const APPEARANCE_LABELS: Record<Appearance, string> = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };

/**
 * Colors of each miniature, written out here and not read from the page's variables: a preview must show its own
 * theme even while another one is active.
 */
const PREVIEW = {
  dark: { canvas: '#000000', elevated: '#1c1c1e', line: '#ffffff', accent: '#eb4854' },
  light: { canvas: '#ffffff', elevated: '#f2f2f7', line: '#000000', accent: '#fa233b' },
  azul: { canvas: '#eef3fa', elevated: '#ffffff', line: '#0c2550', accent: '#1d5fc7' },
  ferro: { canvas: '#15181c', elevated: '#20252b', line: '#d8f5d0', accent: '#3ddc5a' }
} as const;

/** A small screen of the theme: top strip, a title, two cards, a button and the bottom bar. Drawn with plain boxes. */
export const ThemePreview: React.FC<{ theme: Theme }> = ({ theme }) => {
  const p = theme === 'azul' ? PREVIEW.azul : theme === 'ferro' ? PREVIEW.ferro : PREVIEW.dark;
  // The standard theme shows both schemes, split on the diagonal: it is the one that follows the appearance
  const canvas = theme === 'padrao' ? `linear-gradient(135deg, ${PREVIEW.light.canvas} 50%, ${PREVIEW.dark.canvas} 50%)` : p.canvas;
  const block = theme === 'padrao' ? 'rgb(128 128 140 / 0.45)' : p.elevated;
  const line = theme === 'padrao' ? 'rgb(128 128 140 / 0.7)' : `${p.line}66`;
  return (
    <div aria-hidden="true" className="relative h-full w-full overflow-hidden rounded-[inherit]" style={{ background: canvas }}>
      <div className="mx-[12%] mt-[10%] h-[5%] w-[55%] rounded-full" style={{ background: line }} />
      <div className="mx-[12%] mt-[7%] space-y-[6%]">
        <div className="h-[16%] rounded-[6px]" style={{ background: block }} />
        <div className="h-[16%] rounded-[6px]" style={{ background: block }} />
      </div>
      <div className="mx-[12%] mt-[7%] h-[7%] w-[40%] rounded-full" style={{ background: p.accent }} />
      <div className="absolute inset-x-[12%] bottom-[5%] h-[8%] rounded-full" style={{ background: block }}>
        <div className="absolute left-[18%] top-1/2 h-[45%] w-[20%] -translate-y-1/2 rounded-full" style={{ background: p.accent }} />
      </div>
    </div>
  );
};

interface ThemeChooserProps {
  theme: Theme;
  appearance: Appearance;
  onTheme: (theme: Theme) => void;
  onAppearance: (appearance: Appearance) => void;
}

/**
 * The themes as preview cards. The standard theme has its own choice of appearance (automatic, light, dark), shown
 * under its card only while it is the one chosen: nothing is disabled or hidden away.
 */
export const ThemeChooser: React.FC<ThemeChooserProps> = ({ theme, appearance, onTheme, onAppearance }) => (
  <div className="space-y-3">
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-3">
      {THEMES.map((value) => {
        const chosen = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={chosen}
            onClick={() => onTheme(value)}
            className="flex min-w-0 flex-col items-center gap-2 text-center active:scale-[0.97] transition-transform"
          >
            <span
              className={`relative block aspect-[9/16] w-full overflow-hidden rounded-[18px] shadow-md ${
                chosen ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas' : 'ring-1 ring-separator'
              }`}
            >
              <ThemePreview theme={value} />
              {chosen && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </span>
            <span className={`text-[13px] leading-tight ${chosen ? 'font-semibold text-label' : 'text-label-secondary'}`}>{THEME_LABELS[value]}</span>
          </button>
        );
      })}
    </div>

    {theme === 'padrao' && (
      <div role="radiogroup" aria-label="Aparência" className="flex rounded-lg bg-fill-tertiary p-0.5">
        {APPEARANCES.map((value) => (
          <button
            key={value}
            role="radio"
            aria-checked={appearance === value}
            onClick={() => onAppearance(value)}
            className={`flex-1 rounded-md py-1 text-[13px] transition-colors ${
              appearance === value ? 'bg-segment font-semibold text-label shadow-sm' : 'text-label-secondary'
            }`}
          >
            {APPEARANCE_LABELS[value]}
          </button>
        ))}
      </div>
    )}
  </div>
);
