'use client';

import { useTheme, type ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/cn';

const options: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Clair' },
  { id: 'dark', label: 'Sombre' },
  { id: 'system', label: 'Système' },
];

export default function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Thème d'affichage"
      className="grid grid-cols-3 gap-1.5 rounded-2xl bg-ds-surface2 p-1"
    >
      {options.map((opt) => {
        const selected = preference === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(opt.id)}
            className={cn(
              'rounded-xl px-2 py-2.5 text-center text-xs font-semibold transition-all active:scale-95',
              selected
                ? 'bg-ds-surface text-ds-text shadow-sm ring-1 ring-ds-line'
                : 'text-ds-text2 hover:text-ds-text'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
