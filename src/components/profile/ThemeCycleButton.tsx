'use client';

import { Moon, Sun, DeviceMobile } from '@phosphor-icons/react';
import { useTheme, type ThemePreference } from '@/lib/theme';

const cycle: ThemePreference[] = ['light', 'dark', 'system'];

const meta: Record<
  ThemePreference,
  { label: string; Icon: typeof Sun }
> = {
  light: { label: 'Clair', Icon: Sun },
  dark: { label: 'Sombre', Icon: Moon },
  system: { label: 'Système', Icon: DeviceMobile },
};

/** Compact cycle control for guests (no profile drawer). */
export default function ThemeCycleButton({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const { Icon, label } = meta[preference];

  return (
    <button
      type="button"
      onClick={() => {
        const i = cycle.indexOf(preference);
        setPreference(cycle[(i + 1) % cycle.length]);
      }}
      aria-label={`Thème : ${label}. Appuyer pour changer.`}
      title={`Thème : ${label}`}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-surface text-brand-espresso border border-brand-mocha/10 shadow-sm hover:shadow-md active:scale-95 transition-all ${className}`}
    >
      <Icon size={18} weight="duotone" />
    </button>
  );
}
