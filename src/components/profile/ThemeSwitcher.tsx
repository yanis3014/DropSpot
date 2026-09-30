'use client';

import { useTheme, type ThemePreference } from '@/lib/theme';

const options: { id: ThemePreference; label: string; emoji: string }[] = [
  { id: 'light', label: 'Clair', emoji: '☀️' },
  { id: 'dark', label: 'Sombre', emoji: '🌙' },
  { id: 'system', label: 'Système', emoji: '📱' },
];

export default function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Thème d'affichage"
      className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-brand-muted border border-brand-mocha/10"
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
            className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              selected
                ? 'bg-brand-surface text-brand-espresso shadow-sm ring-1 ring-brand-mocha/15'
                : 'text-brand-mocha hover:text-brand-espresso'
            }`}
          >
            <span className="text-base leading-none">{opt.emoji}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
